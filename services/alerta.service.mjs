import db from "../database/database.mjs";
import { erro } from "../utils/http.mjs";

// Alertas da saúde do sistema (aba Desempenho do admin).
// Quem abre os alertas é services/monitor.service.mjs (a cada 1 minuto).
// Se o próprio banco estiver travado, o alerta fica em memória e aparece
// mesmo assim no painel; na próxima verificação ele é gravado no banco.

const ORDEM = { info: 0, atencao: 1, critico: 2 };
const emMemoria = new Map(); // chave -> alerta ainda não gravado
// última lista lida do banco, por status: com o banco travado o admin
// continua vendo os alertas que já existiam (e não "0 alertas")
const ultimaLeitura = new Map();

const SELECT_ALERTA = /*sql*/ `
  SELECT id, tipo, chave, severidade, titulo, o_que AS oQue, causa,
         como_resolver AS comoResolver, rota, status, silenciado_ate AS silenciadoAte,
         ocorrencias, criado_em AS criadoEm, atualizado_em AS atualizadoEm,
         resolvido_em AS resolvidoEm
  FROM alerta
`;

const paraResposta = (alerta) => ({
  ...alerta,
  // "1. Faça isto\n2. Depois aquilo" -> ["Faça isto", "Depois aquilo"]
  passos: String(alerta.comoResolver ?? "").split("\n").map((p) => p.replace(/^\d+\.\s*/, "").trim()).filter(Boolean),
});

// Abre o alerta (ou atualiza o que já está aberto com a mesma chave).
// Devolve { alerta, novo } ou null quando está silenciado.
export function abrirAlerta(dados, agora = Date.now()) {
  try {
    return gravar(dados, agora);
  } catch (error) {
    // banco travado: guarda em memória para o admin ver mesmo assim
    const anterior = emMemoria.get(dados.chave);
    const alerta = {
      ...dados,
      id: `memoria:${dados.chave}`,
      status: "ativo",
      ocorrencias: (anterior?.ocorrencias ?? 0) + 1,
      criadoEm: anterior?.criadoEm ?? agora,
      atualizadoEm: agora,
      naoGravado: true,
      motivoNaoGravado: error.message,
    };
    emMemoria.set(dados.chave, alerta);
    return { alerta: paraResposta(alerta), novo: !anterior };
  }
}

function gravar({ tipo, chave, severidade, titulo, oQue, causa, comoResolver, rota = null }, agora) {
  const aberto = db.prepare(`${SELECT_ALERTA} WHERE chave = ? AND status IN ('ativo', 'silenciado') ORDER BY id DESC LIMIT 1`).get(chave);
  const pendente = emMemoria.get(chave);

  if (aberto) {
    if (aberto.status === "silenciado" && aberto.silenciadoAte > agora) {
      db.prepare("UPDATE alerta SET ocorrencias = ocorrencias + 1, atualizado_em = ? WHERE id = ?").run(agora, aberto.id);
      emMemoria.delete(chave);
      return null;
    }
    const pior = ORDEM[severidade] > ORDEM[aberto.severidade] ? severidade : aberto.severidade;
    db.prepare(/*sql*/ `
      UPDATE alerta
      SET status = 'ativo', silenciado_ate = NULL, severidade = ?, titulo = ?, o_que = ?, causa = ?,
          como_resolver = ?, ocorrencias = ocorrencias + ?, atualizado_em = ?
      WHERE id = ?
    `).run(pior, titulo, oQue, causa, comoResolver, pendente?.ocorrencias ?? 1, agora, aberto.id);
    emMemoria.delete(chave);
    return { alerta: buscarAlerta(aberto.id), novo: aberto.status === "silenciado" };
  }

  const { lastInsertRowid } = db.prepare(/*sql*/ `
    INSERT INTO alerta (tipo, chave, severidade, titulo, o_que, causa, como_resolver, rota,
                        ocorrencias, criado_em, atualizado_em)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(tipo, chave, severidade, titulo, oQue, causa, comoResolver, rota,
    pendente?.ocorrencias ?? 1, pendente?.criadoEm ?? agora, agora);
  emMemoria.delete(chave);
  // se já estava em memória, o admin já foi avisado
  return { alerta: buscarAlerta(Number(lastInsertRowid)), novo: !pendente };
}

// Tenta gravar os alertas que ficaram em memória (chamado a cada verificação)
export function gravarAlertasPendentes(agora = Date.now()) {
  for (const alerta of [...emMemoria.values()]) {
    try {
      gravar({ ...alerta, ocorrencias: undefined }, agora);
    } catch {
      return; // banco ainda travado: tenta na próxima
    }
  }
}

export function buscarAlerta(id) {
  const alerta = db.prepare(`${SELECT_ALERTA} WHERE id = ?`).get(id);
  return alerta ? paraResposta(alerta) : null;
}

// status: ativo (inclui silenciados vencidos) | silenciado | resolvido | todos
export function listarAlertas({ status = "ativo", limite = 100 } = {}, agora = Date.now()) {
  if (!["ativo", "silenciado", "resolvido", "todos"].includes(status)) {
    throw erro(400, "status deve ser ativo, silenciado, resolvido ou todos.");
  }
  let doBanco = [];
  let bancoDisponivel = true;
  try {
    // silêncio de 1 hora acabou: volta a ser ativo
    db.prepare("UPDATE alerta SET status = 'ativo', silenciado_ate = NULL WHERE status = 'silenciado' AND silenciado_ate <= ?").run(agora);
    const onde = status === "todos" ? "" : "WHERE status = ?";
    const ordem = status === "resolvido" ? "resolvido_em DESC" : "atualizado_em DESC";
    doBanco = db.prepare(`${SELECT_ALERTA} ${onde} ORDER BY ${ordem} LIMIT ?`)
      .all(...(status === "todos" ? [] : [status]), limite)
      .map(paraResposta);
    ultimaLeitura.set(status, doBanco);
  } catch {
    bancoDisponivel = false;
    doBanco = (ultimaLeitura.get(status) ?? []).filter((a) => !emMemoria.has(a.chave));
  }
  const daMemoria = ["ativo", "todos"].includes(status) ? [...emMemoria.values()].map(paraResposta) : [];
  const alertas = [...daMemoria, ...doBanco].sort((a, b) =>
    status === "resolvido" ? 0 : ORDEM[b.severidade] - ORDEM[a.severidade] || b.atualizadoEm - a.atualizadoEm);
  return { alertas, bancoDisponivel };
}

export function resolverAlerta(id, agora = Date.now()) {
  if (String(id).startsWith("memoria:")) {
    if (!emMemoria.delete(String(id).slice("memoria:".length))) throw erro(404, "Alerta não encontrado.");
    return { id, status: "resolvido" };
  }
  const { changes } = db.prepare("UPDATE alerta SET status = 'resolvido', resolvido_em = ?, silenciado_ate = NULL WHERE id = ? AND status <> 'resolvido'").run(agora, Number(id));
  if (!changes) throw erro(404, "Alerta não encontrado ou já resolvido.");
  return buscarAlerta(Number(id));
}

export function silenciarAlerta(id, minutos = 60, agora = Date.now()) {
  if (!Number.isFinite(minutos) || minutos < 5 || minutos > 24 * 60) throw erro(400, "Silencie por 5 minutos a 24 horas.");
  if (String(id).startsWith("memoria:")) throw erro(409, "O banco está travado: este alerta ainda não pode ser silenciado.");
  const { changes } = db.prepare("UPDATE alerta SET status = 'silenciado', silenciado_ate = ? WHERE id = ? AND status <> 'resolvido'").run(agora + minutos * 60000, Number(id));
  if (!changes) throw erro(404, "Alerta não encontrado ou já resolvido.");
  return buscarAlerta(Number(id));
}

// só para os testes
export function limparAlertasEmMemoria() {
  emMemoria.clear();
}
