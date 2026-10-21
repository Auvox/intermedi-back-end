import { performance } from "node:perf_hooks";
import db, { emTransacao } from "../database/database.mjs";
import { abrirAlerta, gravarAlertasPendentes } from "./alerta.service.mjs";

// Saúde do sistema: o server.mjs chama registrarRequisicao() ao fim de cada
// requisição e iniciarMonitor() ao subir.
//   • As requisições dos últimos 15 minutos ficam em memória: as regras de
//     alerta funcionam mesmo com o banco travado.
//   • A cada 5 s elas são gravadas em requisicao_log (se o banco falhar, ficam
//     na fila e entram na próxima).
//   • A cada 1 minuto as regras abaixo são verificadas.
//   • A cada 1 hora: apaga requisições e erros com mais de 30 dias e cliques
//     com mais de 180 dias.

const MINUTO = 60000;
const JANELA_REGRAS = 5 * MINUTO;
const MEMORIA = 15 * MINUTO;
const LIMITE_FILA = 20000;

let recentes = [];
let fila = [];
let falhaAoGravar = null; // { mensagem, em }

// rotas de login: muitos 401 seguidos = possível tentativa de invasão
const ROTAS_LOGIN = new Set(["POST /auth/login", "POST /admin/login", "POST /api/auth/login"]);

// O próprio painel consulta estas rotas a cada poucos segundos: não entram
// nas estatísticas para não esconder o uso real
const NAO_REGISTRAR = new Set(["GET /alertas", "GET /saude"]);

export function plataformaDaRequisicao(req, caminho) {
  const informada = req.headers["x-intermedi-plataforma"];
  if (informada === "app" || informada === "web") return informada;
  return caminho.startsWith("/api/") ? "app" : "web";
}

export function registrarRequisicao({ rota, metodo, status, duracaoMs, usuario = null, plataforma = null }, agora = Date.now()) {
  if (NAO_REGISTRAR.has(`${metodo} ${rota}`)) return;
  const registro = { rota, metodo, status, duracaoMs: Math.round(duracaoMs * 10) / 10, usuario, plataforma, criadoEm: agora };
  recentes.push(registro);
  fila.push(registro);
  if (fila.length > LIMITE_FILA) fila.splice(0, fila.length - LIMITE_FILA);
}

// Erro 500: guarda a mensagem e o começo do stack (sem dados da requisição)
export function registrarErro({ error, rota = null, metodo = null }, agora = Date.now()) {
  const mensagem = String(error?.message || error || "Erro desconhecido").slice(0, 500);
  const stack = String(error?.stack ?? "").split("\n").slice(0, 6).join("\n") || null;
  try {
    db.prepare("INSERT INTO erro_log (mensagem, stack, rota, metodo, criado_em) VALUES (?, ?, ?, ?, ?)")
      .run(mensagem, stack, rota, metodo, agora);
  } catch (falha) {
    falhaAoGravar = { mensagem: falha.message, em: agora };
  }
}

export function gravarFila(agora = Date.now()) {
  recentes = recentes.filter((r) => r.criadoEm >= agora - MEMORIA);
  if (!fila.length) return true;
  const lote = fila;
  try {
    const inserir = db.prepare(/*sql*/ `
      INSERT INTO requisicao_log (rota, metodo, status, duracao_ms, usuario, plataforma, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    emTransacao(() => {
      for (const r of lote) inserir.run(r.rota, r.metodo, r.status, r.duracaoMs, r.usuario, r.plataforma, r.criadoEm);
    });
    fila = fila.slice(lote.length);
    falhaAoGravar = null;
    return true;
  } catch (error) {
    falhaAoGravar = { mensagem: error.message, em: agora };
    return false;
  }
}

// Testa se o banco aceita escrita agora (SQLITE_BUSY = travado por outro programa)
export function sondarBanco() {
  const inicio = performance.now();
  try {
    db.exec("BEGIN IMMEDIATE");
    db.exec("ROLLBACK");
    return { ok: true, ms: performance.now() - inicio };
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* não havia transação */ }
    return { ok: false, ms: performance.now() - inicio, mensagem: error.message };
  }
}

const percentil = (valores, p) => {
  if (!valores.length) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  return ordenados[Math.min(ordenados.length - 1, Math.ceil((p / 100) * ordenados.length) - 1)];
};
const segundos = (ms) => (ms / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const travado = (mensagem = "") => /locked|busy/i.test(mensagem);

function causaDosErros(rota, metodo, desde) {
  let mensagem = "";
  try {
    mensagem = db.prepare("SELECT mensagem FROM erro_log WHERE rota = ? AND metodo = ? AND criado_em >= ? ORDER BY id DESC LIMIT 1")
      .get(rota, metodo, desde)?.mensagem ?? "";
  } catch (error) {
    mensagem = error.message;
  }
  if (travado(mensagem)) return "O banco de dados está ocupado ou travado e não respondeu a tempo.";
  if (mensagem) return `O servidor encontrou um erro ao responder esta rota: "${mensagem}".`;
  return "O servidor está com um erro interno ao processar esta rota.";
}

const PASSOS_ROTA = [
  "Abra Desempenho > Saúde do sistema e veja os últimos erros desta rota.",
  "Confira se o servidor e o banco de dados estão no ar.",
  "Se o problema começou depois de uma atualização, volte a versão anterior ou corrija o código desta rota.",
  "Reinicie o serviço (npm run dev) e acompanhe se os erros param.",
];
const numerados = (passos) => passos.map((p, i) => `${i + 1}. ${p}`).join("\n");

// Verifica as regras e abre/atualiza os alertas. Devolve os alertas NOVOS.
export function verificarAlertas(agora = Date.now()) {
  gravarFila(agora);
  gravarAlertasPendentes(agora);
  const desde = agora - JANELA_REGRAS;
  const janela = recentes.filter((r) => r.criadoEm >= desde);
  const novos = [];
  const abrir = (dados) => {
    const resultado = abrirAlerta(dados, agora);
    if (resultado?.novo) novos.push(resultado.alerta);
  };

  // por rota
  const porRota = new Map();
  for (const r of janela) {
    const chave = `${r.metodo} ${r.rota}`;
    if (!porRota.has(chave)) porRota.set(chave, []);
    porRota.get(chave).push(r);
  }
  for (const [chave, lista] of porRota) {
    const { rota, metodo } = lista[0];
    const erros = lista.filter((r) => r.status >= 500).length;
    const taxa = erros / lista.length;
    const ultimas = lista.slice(-3);

    if (ultimas.length === 3 && ultimas.every((r) => r.status >= 500)) {
      abrir({
        tipo: "rota-fora", chave: `rota-fora:${chave}`, severidade: "critico", rota,
        titulo: `A rota ${rota} parou de responder`,
        oQue: `As últimas 3 requisições para ${rota} (${metodo}) terminaram em erro. Quem usa esta tela não consegue concluir o que precisa.`,
        causa: causaDosErros(rota, metodo, desde),
        comoResolver: numerados(PASSOS_ROTA),
      });
    } else if (lista.length >= 5 && taxa > 0.05) {
      const pct = Math.round(taxa * 100);
      abrir({
        tipo: "erro-rota", chave: `erro-rota:${chave}`, severidade: taxa > 0.2 ? "critico" : "atencao", rota,
        titulo: `A rota ${rota} está falhando`,
        oQue: `A rota ${rota} está falhando em ${pct}% das requisições dos últimos 5 minutos (${erros} de ${lista.length}).`,
        causa: causaDosErros(rota, metodo, desde),
        comoResolver: numerados(PASSOS_ROTA),
      });
    }

    const p95 = percentil(lista.map((r) => r.duracaoMs), 95);
    if (lista.length >= 5 && p95 > 1000) {
      abrir({
        tipo: "rota-lenta", chave: `rota-lenta:${chave}`, severidade: p95 > 3000 ? "critico" : "atencao", rota,
        titulo: `A rota ${rota} está lenta`,
        oQue: `As respostas mais lentas de ${rota} estão levando ${segundos(p95)} s. O normal é menos de 1 s.`,
        causa: "Pode ser uma consulta pesada no banco de dados, muitos acessos ao mesmo tempo ou o computador do servidor sobrecarregado.",
        comoResolver: numerados([
          "Veja em Saúde do sistema se outras rotas também ficaram lentas (aí o problema é o servidor, não a rota).",
          "Feche programas pesados no computador do servidor.",
          "Se só esta rota está lenta, revise a consulta ao banco que ela faz.",
          "Reinicie o serviço (npm run dev) e acompanhe o tempo de resposta.",
        ]),
      });
    }
  }

  // muitas falhas de login
  const loginsErrados = janela.filter((r) => ROTAS_LOGIN.has(`${r.metodo} ${r.rota}`) && r.status === 401).length;
  if (loginsErrados >= 10) {
    abrir({
      tipo: "login", chave: "login:falhas", severidade: loginsErrados >= 30 ? "critico" : "atencao",
      titulo: "Muitas tentativas de login erradas",
      oQue: `${loginsErrados} tentativas de login com senha errada nos últimos 5 minutos.`,
      causa: "Alguém pode estar tentando adivinhar senhas, ou uma pessoa esqueceu a senha e está tentando várias vezes.",
      comoResolver: numerados([
        "Pergunte à equipe se alguém está com dificuldade para entrar.",
        "Se ninguém reconhecer, troque a senha das contas de admin e gerente (npm run acesso:reenviar).",
        "Ligue a exigência de login (INTERMEDI_EXIGIR_LOGIN=true no .env) se ainda estiver desligada.",
      ]),
    });
  }

  // lote do mapa de calor falhando
  const lotesComErro = janela.filter((r) => r.metodo === "POST" && r.rota === "/analytics/cliques" && r.status >= 500).length;
  if (lotesComErro) {
    abrir({
      tipo: "analytics", chave: "analytics:cliques", severidade: "atencao", rota: "/analytics/cliques",
      titulo: "Os cliques do mapa de calor não estão sendo salvos",
      oQue: `${lotesComErro} ${lotesComErro === 1 ? "lote de cliques não foi salvo" : "lotes de cliques não foram salvos"} nos últimos 5 minutos. O mapa de calor vai ficar com buracos neste período.`,
      causa: causaDosErros("/analytics/cliques", "POST", desde),
      comoResolver: numerados([
        "Confira se o banco de dados está no ar (veja se há alerta de banco travado).",
        "Veja os últimos erros da rota /analytics/cliques em Saúde do sistema.",
        "Reinicie o serviço (npm run dev). Os próximos lotes voltam a ser salvos sozinhos.",
      ]),
    });
  }

  // banco de dados
  const sonda = sondarBanco();
  if (!sonda.ok || falhaAoGravar) {
    const mensagem = sonda.mensagem || falhaAoGravar?.mensagem || "";
    abrir({
      tipo: "banco", chave: "banco:indisponivel", severidade: "critico",
      titulo: travado(mensagem) ? "O banco de dados está travado" : "O banco de dados está com erro",
      oQue: "O sistema não está conseguindo gravar no banco de dados. Cadastros, chamados e pedidos podem falhar.",
      causa: travado(mensagem)
        ? "Outro programa está usando o arquivo do banco (por exemplo o DB Browser ou o VS Code com o banco aberto), ou uma operação longa não terminou."
        : `O banco respondeu com erro: "${mensagem}".`,
      comoResolver: numerados([
        "Feche programas que estejam com o arquivo do banco aberto (DB Browser, VS Code).",
        "Aguarde 1 minuto e veja se o alerta para de se repetir.",
        "Se continuar, pare o servidor (Ctrl+C) e inicie de novo com npm run dev.",
        "Se o arquivo estiver corrompido, restaure o backup mais recente da pasta database/.",
      ]),
    });
  } else if (sonda.ms > 500) {
    abrir({
      tipo: "banco-lento", chave: "banco:lento", severidade: "atencao",
      titulo: "O banco de dados está lento",
      oQue: `O banco demorou ${segundos(sonda.ms)} s para responder a um teste simples. O normal é menos de 0,1 s.`,
      causa: "O computador do servidor pode estar sobrecarregado ou o disco está lento.",
      comoResolver: numerados([
        "Feche programas pesados no computador do servidor.",
        "Confira se o disco não está cheio.",
        "Reinicie o serviço (npm run dev).",
      ]),
    });
  }

  return novos;
}

export function limparAntigos(agora = Date.now()) {
  try {
    const trintaDias = agora - 30 * 24 * 60 * MINUTO;
    const centoOitentaDias = agora - 180 * 24 * 60 * MINUTO;
    db.prepare("DELETE FROM requisicao_log WHERE criado_em < ?").run(trintaDias);
    db.prepare("DELETE FROM erro_log WHERE criado_em < ?").run(trintaDias);
    db.prepare("DELETE FROM clique_evento WHERE criado_em < ?").run(centoOitentaDias);
    db.prepare("DELETE FROM tela_visita WHERE criado_em < ?").run(centoOitentaDias);
  } catch {
    // banco travado: tenta na próxima hora
  }
}

// estado atual (usado pela aba Saúde do sistema)
export function estadoMonitor() {
  return { filaPendente: fila.length, falhaAoGravar };
}

let iniciado = false;
export function iniciarMonitor() {
  if (iniciado) return;
  iniciado = true;
  setInterval(() => gravarFila(), 5000).unref();
  setInterval(() => {
    for (const alerta of verificarAlertas()) {
      console.warn(`[alerta ${alerta.severidade}] ${alerta.titulo}`);
    }
  }, MINUTO).unref();
  limparAntigos();
  setInterval(() => limparAntigos(), 60 * MINUTO).unref();
}

// só para os testes
export function reiniciarMonitorParaTeste() {
  recentes = [];
  fila = [];
  falhaAoGravar = null;
}
