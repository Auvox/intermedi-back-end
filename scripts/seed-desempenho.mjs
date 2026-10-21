// Dados de demonstração da aba "Desempenho" do admin:
//   npm run desempenho:seed            (30 dias)
//   npm run desempenho:seed -- --dias 14
// Gera cliques (concentrados nos botões principais de cada tela), visitas,
// requisições com picos em horário comercial, alguns erros e incidentes,
// 2 alertas ativos e um histórico de alertas resolvidos.
// APAGA antes os dados de uso e saúde (cliques, visitas, requisições, erros e
// alertas); cadastros e o main-data.json não são tocados.
// As posições dos botões do web vêm de scripts/dados/alvos-desempenho.json
// (medidas nas telas reais, em fração da tela).
import { readFileSync } from "node:fs";
import db, { emTransacao } from "../database/database.mjs";

if (process.env.NODE_ENV === "production") {
  console.error("Não rode o seed de demonstração em produção.");
  process.exit(1);
}

const argDias = process.argv.indexOf("--dias");
const DIAS = argDias > 0 ? Math.min(90, Math.max(1, Number(process.argv[argDias + 1]) || 30)) : 30;
const HORA = 3600000;
const MIN = 60000;
const AGORA = Date.now();
const alvosWeb = JSON.parse(readFileSync(new URL("./dados/alvos-desempenho.json", import.meta.url), "utf8"));

// ------------------------------------------------ sorteio reproduzível
let semente = 20261022;
const aleatorio = () => {
  semente = (semente + 0x6d2b79f5) | 0;
  let t = Math.imul(semente ^ (semente >>> 15), 1 | semente);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const inteiro = (min, max) => min + Math.floor(aleatorio() * (max - min + 1));
const normal = () => Math.sqrt(-2 * Math.log(aleatorio() || 1e-9)) * Math.cos(2 * Math.PI * aleatorio());
const lognormal = (mediana, espalhamento) => mediana * Math.exp(normal() * espalhamento);
const escolher = (lista) => lista[Math.floor(aleatorio() * lista.length)];
function sortear(pesos) {
  const total = pesos.reduce((s, [, p]) => s + p, 0);
  let r = aleatorio() * total;
  for (const [valor, peso] of pesos) if ((r -= peso) <= 0) return valor;
  return pesos.at(-1)[0];
}
const limitar = (v) => Math.min(0.999, Math.max(0.001, v));

// movimento por hora: picos às 10h e às 15h, quase nada de madrugada
const PESO_HORA = [0.1, 0.05, 0.03, 0.03, 0.05, 0.1, 0.3, 0.8, 1.6, 2.3, 2.6, 2.4, 1.6, 1.8, 2.3, 2.6, 2.3, 1.8, 1.2, 0.8, 0.6, 0.45, 0.3, 0.2];
function horarioNoDia(inicioDia) {
  const hora = sortear(PESO_HORA.map((p, h) => [h, p]));
  return inicioDia + hora * HORA + Math.floor(aleatorio() * HORA);
}

// ------------------------------------------------ cadastros reais
const gerentes = db.prepare("SELECT id_gerente AS id, id_farmacia AS farmacia FROM gerente").all();
const funcionarios = db.prepare("SELECT id_funcionario AS id, id_farmacia AS farmacia FROM funcionario").all();
const farmacias = db.prepare("SELECT id_farmacia AS id FROM farmacia").all().map((f) => f.id);
const admin = db.prepare("SELECT id_admin AS id FROM admin ORDER BY id_admin LIMIT 1").get();
if (!gerentes.length || !funcionarios.length) {
  console.error("Cadastre gerentes e funcionários antes (npm run db:seed).");
  process.exit(1);
}

// ------------------------------------------------ telas e o que cada uma pede à API
const WEB = {
  admin: {
    entrada: "/admin",
    telas: [["/admin", 5], ["/admin/chamados", 3], ["/admin/medicamentos", 2], ["/admin/farmacias", 2], ["/admin/gerentes", 2], ["/admin/pacientes", 1]],
  },
  gerente: {
    entrada: "/gerente",
    telas: [["/gerente", 5], ["/gerente/chamados", 6], ["/gerente/remedios", 4], ["/gerente/pedidos", 3], ["/gerente/funcionarios", 2], ["/gerente/servicos", 2], ["/gerente/pacientes", 1], ["/gerente/operacao", 1.5]],
  },
  funcionario: {
    entrada: "/funcionario",
    telas: [["/funcionario", 4], ["/funcionario/servicos", 6], ["/funcionario/pacientes", 4], ["/funcionario/chamados", 3], ["/funcionario/remedios", 3], ["/funcionario/funcionarios", 0.6]],
  },
};
const TEMPO_TELA = { "/gerente/operacao": 140000, "/gerente/chamados": 70000, "/funcionario/servicos": 80000, "/admin": 55000 };

const API_DA_TELA = {
  "/admin": [["GET", "/farmacia"], ["GET", "/farmacia/:id/resumo"], ["GET", "/paciente"], ["GET", "/remedios"]],
  "/admin/chamados": [["GET", "/farmacia"], ["GET", "/gerente/:id/chamados"]],
  "/admin/medicamentos": [["GET", "/remedios"], ["GET", "/categorias"]],
  "/admin/farmacias": [["GET", "/farmacia"]],
  "/admin/gerentes": [["GET", "/gerente"], ["GET", "/farmacia"]],
  "/admin/pacientes": [["GET", "/paciente"]],
  "/gerente": [["GET", "/gerente"], ["GET", "/gerente/:id/estoque"], ["GET", "/gerente/:id/chamados"], ["GET", "/gerente/:id/redistribuicoes"]],
  "/gerente/chamados": [["GET", "/gerente/:id/chamados"], ["GET", "/chamado/:id/disponibilidade"], ["PUT", "/chamado/:id/responder"]],
  "/gerente/remedios": [["GET", "/gerente/:id/estoque"], ["GET", "/remedios"], ["PUT", "/gerente/:id/estoque/:idRemedio"]],
  "/gerente/pedidos": [["GET", "/gerente/:id/redistribuicoes"], ["PUT", "/redistribuicao/:id/responder"]],
  "/gerente/funcionarios": [["GET", "/funcionario"], ["GET", "/farmacia"]],
  "/gerente/servicos": [["GET", "/servicos"]],
  "/gerente/pacientes": [["GET", "/paciente"]],
  "/gerente/operacao": [["GET", "/gerente/:id/estoque"], ["GET", "/funcionario"], ["GET", "/gerente/:id/redistribuicoes"]],
  "/funcionario": [["GET", "/funcionario/:id/chamados"], ["GET", "/farmacia/:id/estoque"], ["GET", "/servicos"], ["GET", "/funcionario/:id/preparos"]],
  "/funcionario/servicos": [["GET", "/servicos"], ["GET", "/paciente"], ["POST", "/servicos"]],
  "/funcionario/pacientes": [["GET", "/paciente"], ["GET", "/paciente/:id"]],
  "/funcionario/chamados": [["GET", "/funcionario/:id/chamados"], ["POST", "/funcionario/:id/chamado"]],
  "/funcionario/remedios": [["GET", "/farmacia/:id/estoque"], ["GET", "/remedios"]],
  "/funcionario/funcionarios": [["GET", "/funcionario"]],
};

// App do paciente (390 × 844). A barra de abas fica embaixo, na ordem do app.
const ABAS = ["farmacias", "buscar-medicamentos", "inicio", "broto", "favoritos", "perfil"];
const abaAlvo = (nome, i) => ({ e: `aba:${nome}`, x: (i + 0.5) / 6, y: 0.935, w: 0.13, h: 0.05 });
const BARRA = ABAS.map(abaAlvo);
const ALVOS_APP = {
  "/": [{ e: "busca", x: 0.5, y: 0.2, w: 0.85, h: 0.06 }, { e: "card-rotina", x: 0.5, y: 0.37, w: 0.88, h: 0.14 }, { e: "card-mascote", x: 0.27, y: 0.6, w: 0.42, h: 0.16 }, { e: "card-farmacia-proxima", x: 0.73, y: 0.6, w: 0.42, h: 0.16 }, { e: "notificacoes", x: 0.89, y: 0.07, w: 0.1, h: 0.05 }, ...BARRA],
  "/buscar-medicamentos": [{ e: "busca", x: 0.5, y: 0.17, w: 0.85, h: 0.06 }, { e: "foto-remedio", x: 0.86, y: 0.17, w: 0.1, h: 0.05 }, { e: "categoria", x: 0.3, y: 0.28, w: 0.25, h: 0.04 }, { e: "resultado", x: 0.5, y: 0.42, w: 0.9, h: 0.1 }, { e: "resultado", x: 0.5, y: 0.54, w: 0.9, h: 0.1 }, ...BARRA],
  "/farmacias": [{ e: "mapa", x: 0.5, y: 0.32, w: 0.95, h: 0.35 }, { e: "farmacia-card", x: 0.5, y: 0.62, w: 0.9, h: 0.1 }, { e: "farmacia-card", x: 0.5, y: 0.74, w: 0.9, h: 0.1 }, { e: "filtro-aberta", x: 0.25, y: 0.12, w: 0.3, h: 0.04 }, ...BARRA],
  "/pesquisa": [{ e: "busca", x: 0.5, y: 0.12, w: 0.85, h: 0.06 }, { e: "resultado", x: 0.5, y: 0.3, w: 0.9, h: 0.1 }, { e: "resultado", x: 0.5, y: 0.42, w: 0.9, h: 0.1 }, { e: "voltar", x: 0.08, y: 0.06, w: 0.1, h: 0.05 }],
  "/medicamento/:id": [{ e: "ver-farmacias", x: 0.5, y: 0.86, w: 0.85, h: 0.07 }, { e: "favoritar", x: 0.9, y: 0.07, w: 0.1, h: 0.05 }, { e: "adicionar-rotina", x: 0.5, y: 0.76, w: 0.85, h: 0.06 }, { e: "voltar", x: 0.08, y: 0.06, w: 0.1, h: 0.05 }],
  "/farmacia/:id": [{ e: "como-chegar", x: 0.5, y: 0.86, w: 0.85, h: 0.07 }, { e: "ligar", x: 0.3, y: 0.42, w: 0.35, h: 0.05 }, { e: "estoque-item", x: 0.5, y: 0.6, w: 0.9, h: 0.08 }, { e: "voltar", x: 0.08, y: 0.06, w: 0.1, h: 0.05 }],
  "/rota": [{ e: "iniciar-rota", x: 0.5, y: 0.88, w: 0.85, h: 0.07 }, { e: "mapa", x: 0.5, y: 0.4, w: 0.95, h: 0.5 }, { e: "voltar", x: 0.08, y: 0.06, w: 0.1, h: 0.05 }],
  "/favoritos": [{ e: "favorito", x: 0.5, y: 0.25, w: 0.9, h: 0.09 }, { e: "favorito", x: 0.5, y: 0.36, w: 0.9, h: 0.09 }, ...BARRA],
  "/perfil": [{ e: "meus-dados", x: 0.5, y: 0.35, w: 0.9, h: 0.06 }, { e: "acessibilidade", x: 0.5, y: 0.43, w: 0.9, h: 0.06 }, { e: "configuracoes", x: 0.5, y: 0.51, w: 0.9, h: 0.06 }, { e: "sair", x: 0.5, y: 0.75, w: 0.9, h: 0.06 }, ...BARRA],
  "/broto": [{ e: "alimentar-mascote", x: 0.5, y: 0.7, w: 0.6, h: 0.07 }, { e: "mascote", x: 0.5, y: 0.4, w: 0.6, h: 0.25 }, ...BARRA],
  "/semana": [{ e: "dia", x: 0.3, y: 0.2, w: 0.12, h: 0.06 }, { e: "dose-tomada", x: 0.85, y: 0.4, w: 0.12, h: 0.05 }, { e: "dose-tomada", x: 0.85, y: 0.5, w: 0.12, h: 0.05 }, { e: "voltar", x: 0.08, y: 0.06, w: 0.1, h: 0.05 }],
  "/notificacoes": [{ e: "notificacao", x: 0.5, y: 0.22, w: 0.9, h: 0.08 }, { e: "voltar", x: 0.08, y: 0.06, w: 0.1, h: 0.05 }],
};
const TELAS_APP = [["/", 8], ["/buscar-medicamentos", 6], ["/farmacias", 4], ["/pesquisa", 3], ["/medicamento/:id", 4], ["/farmacia/:id", 3], ["/rota", 2], ["/favoritos", 1.5], ["/perfil", 1.5], ["/broto", 1], ["/semana", 1.5], ["/notificacoes", 1]];
const API_DO_APP = {
  "/": [["GET", "/api/pacientes/me"], ["GET", "/farmacia"]],
  "/buscar-medicamentos": [["GET", "/remedios"], ["GET", "/categorias"], ["POST", "/remedios/reconhecer-foto"]],
  "/farmacias": [["GET", "/farmacia"]],
  "/pesquisa": [["GET", "/remedios"]],
  "/medicamento/:id": [["GET", "/remedios/:id"], ["GET", "/farmacia"]],
  "/farmacia/:id": [["GET", "/farmacia/:id"], ["GET", "/farmacia/:id/estoque"]],
  "/rota": [["POST", "/rotas"]],
  "/favoritos": [["GET", "/remedios"]],
  "/perfil": [["GET", "/api/pacientes/me"]],
  "/broto": [],
  "/semana": [],
  "/notificacoes": [["GET", "/api/pacientes/me"]],
};
// rotas mais pesadas
const MEDIANA_MS = { "POST /remedios/reconhecer-foto": 900, "POST /rotas": 260, "GET /farmacia/:id/resumo": 70 };

const MENSAGENS_ERRO = {
  "GET /remedios": "database is locked",
  "POST /remedios/reconhecer-foto": "Falha ao carregar o idioma do leitor de fotos (por.traineddata).",
  "POST /rotas": "O serviço de geocodificação não respondeu a tempo.",
};

// ------------------------------------------------ geração
const cliques = [];
const visitas = [];
const requisicoes = [];
const erros = [];
let sessoes = 0;

function dispositivoWeb() {
  return sortear([["desktop", 82], ["tablet", 10], ["celular", 8]]);
}
const TAMANHO = { desktop: [1440, 900], tablet: [820, 1180], celular: [390, 844] };

function alvosDa(rota, plataforma, dispositivo) {
  if (plataforma === "app") return ALVOS_APP[rota] ?? BARRA;
  const medidas = alvosWeb[dispositivo === "celular" ? "celular" : "desktop"] ?? alvosWeb.desktop;
  return medidas[rota] ?? alvosWeb.desktop[rota] ?? [];
}

function gerarCliques(rota, plataforma, dispositivo, comum, inicio, duracao) {
  const alvos = alvosDa(rota, plataforma, dispositivo);
  const [largura, altura] = TAMANHO[dispositivo];
  const quantos = Math.max(0, Math.round(lognormal(plataforma === "app" ? 3 : 4, 0.6)));
  for (let i = 0; i < quantos; i++) {
    const em = inicio + Math.floor(aleatorio() * duracao);
    const semResposta = plataforma === "web" && aleatorio() < 0.08;
    if (semResposta || !alvos.length) {
      // clique em algo que não responde (títulos, números, ícones decorativos)
      cliques.push({ ...comum, x: limitar(0.25 + aleatorio() * 0.6), y: limitar(0.12 + aleatorio() * 0.5), elemento: null, interativo: plataforma === "app" ? null : 0, largura, altura, em });
      continue;
    }
    // botões principais (com data-track) recebem mais cliques
    const alvo = sortear(alvos.map((a, j) => [a, (a.e ? (a.e.startsWith("menu:") ? 2 : 5) : 1) / (1 + j * 0.08)]));
    cliques.push({
      ...comum,
      x: limitar(alvo.x + normal() * alvo.w * 0.22),
      y: limitar(alvo.y + normal() * alvo.h * 0.22),
      elemento: alvo.e ?? "button",
      interativo: plataforma === "app" ? null : 1,
      largura,
      altura,
      em,
    });
  }
}

function gerarRequisicoes(rota, plataforma, inicio, duracao, usuario) {
  const chamadas = (plataforma === "app" ? API_DO_APP : API_DA_TELA)[rota] ?? [];
  for (const [metodo, rotaApi] of chamadas) {
    const vezes = metodo === "GET" ? inteiro(1, 3) : aleatorio() < 0.35 ? 1 : 0;
    for (let i = 0; i < vezes; i++) {
      const chave = `${metodo} ${rotaApi}`;
      const status = aleatorio() < 0.004 ? 500 : aleatorio() < 0.015 ? sortear([[400, 2], [404, 2], [409, 1]]) : metodo === "POST" ? 201 : 200;
      const em = inicio + Math.floor(aleatorio() * duracao);
      requisicoes.push({ rota: rotaApi, metodo, status, duracao: Math.max(3, lognormal(MEDIANA_MS[chave] ?? 32, 0.55)), usuario, plataforma, em });
      if (status >= 500) erros.push({ mensagem: MENSAGENS_ERRO[chave] ?? "Não foi possível concluir a operação.", rota: rotaApi, metodo, em });
    }
  }
}

function sessao({ persona, plataforma, usuarioId, farmaciaId, inicio, entrada, telas }) {
  sessoes++;
  const id = `seed-${persona}-${sessoes}`;
  const dispositivo = plataforma === "app" ? sortear([["celular", 92], ["tablet", 8]]) : dispositivoWeb();
  const usuario = plataforma === "app" ? null : `${persona}:${usuarioId}`;
  const quantas = inteiro(2, plataforma === "app" ? 7 : 9);
  let rota = entrada;
  let t = inicio;
  for (let i = 0; i < quantas && t < AGORA; i++) {
    const duracao = Math.min(Math.round(lognormal(TEMPO_TELA[rota] ?? (plataforma === "app" ? 25000 : 45000), 0.7)), 30 * MIN);
    const ultima = i === quantas - 1;
    const comum = { rota, plataforma, persona, usuarioId, farmaciaId: rota === "/farmacia/:id" ? escolher(farmacias) : farmaciaId, dispositivo, sessao: id };
    visitas.push({ ...comum, duracao, saida: ultima ? 1 : 0, em: t });
    gerarCliques(rota, plataforma, dispositivo, comum, t, duracao);
    gerarRequisicoes(rota, plataforma, t, duracao, usuario);
    t += duracao + inteiro(500, 4000);
    rota = sortear(telas.filter(([r]) => r !== rota));
  }
}

const meiaNoite = new Date(AGORA);
meiaNoite.setHours(0, 0, 0, 0);
for (let d = DIAS - 1; d >= 0; d--) {
  const inicioDia = meiaNoite.getTime() - d * 24 * HORA;
  const diaSemana = new Date(inicioDia).getDay();
  const fator = diaSemana === 0 ? 0.35 : diaSemana === 6 ? 0.6 : 1;
  // a rede cresce um pouco ao longo do mês
  const crescimento = 0.8 + 0.4 * ((DIAS - d) / DIAS);

  for (const g of gerentes) {
    for (let i = 0; i < Math.round(inteiro(2, 4) * fator); i++) {
      sessao({ persona: "gerente", plataforma: "web", usuarioId: g.id, farmaciaId: g.farmacia, inicio: horarioNoDia(inicioDia), ...WEB.gerente });
    }
  }
  for (const f of funcionarios) {
    for (let i = 0; i < Math.round(inteiro(2, 5) * fator); i++) {
      sessao({ persona: "funcionario", plataforma: "web", usuarioId: f.id, farmaciaId: f.farmacia, inicio: horarioNoDia(inicioDia), ...WEB.funcionario });
    }
  }
  for (let i = 0; i < Math.round(inteiro(1, 2) * fator); i++) {
    sessao({ persona: "admin", plataforma: "web", usuarioId: admin?.id ?? 1, farmaciaId: null, inicio: horarioNoDia(inicioDia), ...WEB.admin });
  }
  for (let i = 0; i < Math.round(inteiro(35, 60) * fator * crescimento); i++) {
    // pacientes fictícios (ids altos para não confundir com os do seed)
    sessao({ persona: "paciente", plataforma: "app", usuarioId: inteiro(2001, 2400), farmaciaId: null, inicio: horarioNoDia(inicioDia), entrada: "/", telas: TELAS_APP });
  }
}

// incidentes: ontem às 14h a rota /remedios falhou por 40 min (banco travado)
const ontem14h = meiaNoite.getTime() - 24 * HORA + 14 * HORA;
for (let i = 0; i < 160; i++) {
  const em = ontem14h + Math.floor(aleatorio() * 40 * MIN);
  const falhou = aleatorio() < 0.22;
  requisicoes.push({ rota: "/remedios", metodo: "GET", status: falhou ? 500 : 200, duracao: falhou ? lognormal(5000, 0.2) : lognormal(400, 0.5), usuario: null, plataforma: aleatorio() < 0.6 ? "app" : "web", em });
  if (falhou) erros.push({ mensagem: "database is locked", rota: "/remedios", metodo: "GET", em });
}
// e agora: a leitura de foto (OCR) está falhando há 25 minutos
for (let i = 0; i < 40; i++) {
  const em = AGORA - Math.floor(aleatorio() * 25 * MIN);
  const falhou = aleatorio() < 0.45;
  requisicoes.push({ rota: "/remedios/reconhecer-foto", metodo: "POST", status: falhou ? 500 : 200, duracao: lognormal(falhou ? 120 : 950, 0.3), usuario: null, plataforma: "app", em });
  if (falhou) erros.push({ mensagem: MENSAGENS_ERRO["POST /remedios/reconhecer-foto"], rota: "/remedios/reconhecer-foto", metodo: "POST", em });
}
// tentativas de login erradas na última hora
for (let i = 0; i < 14; i++) {
  requisicoes.push({ rota: "/auth/login", metodo: "POST", status: 401, duracao: lognormal(90, 0.2), usuario: null, plataforma: "web", em: AGORA - 70 * MIN + i * 2 * MIN });
}

// ------------------------------------------------ alertas
const passos = (lista) => lista.map((p, i) => `${i + 1}. ${p}`).join("\n");
const ALERTAS = [
  {
    tipo: "erro-rota", chave: "erro-rota:POST /remedios/reconhecer-foto", severidade: "critico", rota: "/remedios/reconhecer-foto",
    titulo: "A rota /remedios/reconhecer-foto está falhando",
    oQue: "A busca de remédio por foto do app está falhando em 45% das requisições dos últimos 5 minutos (9 de 20).",
    causa: `O servidor encontrou um erro ao responder esta rota: "${MENSAGENS_ERRO["POST /remedios/reconhecer-foto"]}"`,
    comoResolver: passos([
      "Confira se o arquivo por.traineddata está na pasta do back-end.",
      "Rode npm install no back-end para reinstalar o leitor de fotos (tesseract.js).",
      "Reinicie o serviço (npm run dev) e teste a busca por foto no app.",
    ]),
    status: "ativo", criado: AGORA - 24 * MIN, ocorrencias: 6,
  },
  {
    tipo: "login", chave: "login:falhas", severidade: "atencao",
    titulo: "Muitas tentativas de login erradas",
    oQue: "14 tentativas de login com senha errada em pouco mais de 1 hora.",
    causa: "Alguém pode estar tentando adivinhar senhas, ou uma pessoa esqueceu a senha e está tentando várias vezes.",
    comoResolver: passos([
      "Pergunte à equipe se alguém está com dificuldade para entrar.",
      "Se ninguém reconhecer, troque a senha das contas de admin e gerente (npm run acesso:reenviar).",
      "Ligue a exigência de login (INTERMEDI_EXIGIR_LOGIN=true no .env) se ainda estiver desligada.",
    ]),
    status: "ativo", criado: AGORA - 65 * MIN, ocorrencias: 3,
  },
  {
    tipo: "rota-fora", chave: "rota-fora:GET /remedios", severidade: "critico", rota: "/remedios",
    titulo: "A rota /remedios parou de responder",
    oQue: "As últimas 3 requisições para /remedios (GET) terminaram em erro. Quem usa esta tela não consegue concluir o que precisa.",
    causa: "O banco de dados está ocupado ou travado e não respondeu a tempo.",
    comoResolver: passos(["Feche programas que estejam com o arquivo do banco aberto.", "Reinicie o serviço (npm run dev)."]),
    status: "resolvido", criado: ontem14h + 6 * MIN, resolvido: ontem14h + 52 * MIN, ocorrencias: 4,
  },
  {
    tipo: "rota-lenta", chave: "rota-lenta:POST /rotas", severidade: "atencao", rota: "/rotas",
    titulo: "A rota /rotas está lenta",
    oQue: "As respostas mais lentas de /rotas estavam levando 2,4 s. O normal é menos de 1 s.",
    causa: "O serviço de mapas estava demorando para responder.",
    comoResolver: passos(["Veja se outras rotas também ficaram lentas.", "Reinicie o serviço (npm run dev)."]),
    status: "resolvido", criado: AGORA - 3 * 24 * HORA, resolvido: AGORA - 3 * 24 * HORA + 35 * MIN, ocorrencias: 2,
  },
  {
    tipo: "banco", chave: "banco:indisponivel", severidade: "critico",
    titulo: "O banco de dados está travado",
    oQue: "O sistema não estava conseguindo gravar no banco de dados.",
    causa: "O arquivo do banco estava aberto no DB Browser.",
    comoResolver: passos(["Feche programas que estejam com o arquivo do banco aberto.", "Aguarde 1 minuto."]),
    status: "resolvido", criado: AGORA - 6 * 24 * HORA, resolvido: AGORA - 6 * 24 * HORA + 12 * MIN, ocorrencias: 1,
  },
];

// ------------------------------------------------ gravação
const limitarAgora = (em) => Math.min(em, AGORA);
emTransacao(() => {
  for (const tabela of ["clique_evento", "tela_visita", "requisicao_log", "erro_log", "alerta"]) db.exec(`DELETE FROM ${tabela}`);

  const clique = db.prepare(/*sql*/ `
    INSERT INTO clique_evento (rota, x, y, elemento, interativo, plataforma, persona, usuario_id, farmacia_id,
                               largura_tela, altura_tela, dispositivo, sessao, criado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const c of cliques) {
    if (c.em > AGORA) continue;
    clique.run(c.rota, c.x, c.y, c.elemento, c.interativo, c.plataforma, c.persona, c.usuarioId, c.farmaciaId, c.largura, c.altura, c.dispositivo, c.sessao, c.em);
  }
  const visita = db.prepare(/*sql*/ `
    INSERT INTO tela_visita (rota, plataforma, persona, usuario_id, farmacia_id, dispositivo, sessao, duracao_ms, saida, criado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const v of visitas) {
    if (v.em > AGORA) continue;
    visita.run(v.rota, v.plataforma, v.persona, v.usuarioId, v.farmaciaId, v.dispositivo, v.sessao, v.duracao, v.saida, v.em);
  }
  const requisicao = db.prepare(/*sql*/ `
    INSERT INTO requisicao_log (rota, metodo, status, duracao_ms, usuario, plataforma, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const r of requisicoes) {
    if (r.em > AGORA) continue;
    requisicao.run(r.rota, r.metodo, r.status, Math.round(r.duracao * 10) / 10, r.usuario, r.plataforma, r.em);
  }
  const erro = db.prepare("INSERT INTO erro_log (mensagem, stack, rota, metodo, criado_em) VALUES (?, NULL, ?, ?, ?)");
  for (const e of erros) if (e.em <= AGORA) erro.run(e.mensagem, e.rota, e.metodo, e.em);

  const alerta = db.prepare(/*sql*/ `
    INSERT INTO alerta (tipo, chave, severidade, titulo, o_que, causa, como_resolver, rota, status, ocorrencias, criado_em, atualizado_em, resolvido_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const a of ALERTAS) {
    alerta.run(a.tipo, a.chave, a.severidade, a.titulo, a.oQue, a.causa, a.comoResolver, a.rota ?? null, a.status, a.ocorrencias,
      a.criado, limitarAgora(a.resolvido ?? a.criado + 5 * MIN), a.resolvido ?? null);
  }
});

console.log(`Desempenho: ${DIAS} dias de demonstração gerados`);
console.log(`  ${sessoes} sessões · ${visitas.length} visitas · ${cliques.length} cliques`);
console.log(`  ${requisicoes.length} requisições · ${erros.length} erros · ${ALERTAS.filter((a) => a.status === "ativo").length} alertas ativos`);
