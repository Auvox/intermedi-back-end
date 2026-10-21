import db, { emTransacao } from "../database/database.mjs";
import { erro } from "../utils/http.mjs";
import { filtroSql, variacao } from "../utils/periodo-desempenho.mjs";
import { listarAlertas } from "./alerta.service.mjs";

// Uso do sistema para a aba "Desempenho" do admin: cliques (mapa de calor),
// visitas às telas (tempo na tela e abandono) e o resumo da visão geral.
// O web e o app mandam os cliques em lote (POST /analytics/cliques).

const PLATAFORMAS = ["app", "web"];
const PERSONAS = ["paciente", "funcionario", "gerente", "admin"];
const DISPOSITIVOS = ["desktop", "tablet", "celular"];
const LIMITE_LOTE = 500;
const DIA_MS = 86400000;

// "/gerente/chamados/?perfil=1" -> "/gerente/chamados"; "/medicamento/12" -> "/medicamento/:id"
export function normalizarRota(rota) {
  const texto = String(rota ?? "").split(/[?#]/)[0].trim();
  if (!texto.startsWith("/") || texto.length > 120) return null;
  const limpa = texto
    .split("/")
    .map((parte) => (/^\d+$/.test(parte) ? ":id" : parte))
    .join("/")
    .replace(/\/+$/, "");
  return limpa || "/";
}

const idOuNulo = (valor) => (Number.isSafeInteger(Number(valor)) && Number(valor) > 0 ? Number(valor) : null);
const inteiro = (valor, min, max) => {
  const n = Math.round(Number(valor));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};
// só identificadores (ex.: "novo-remedio", "menu:remedios"); nunca texto livre
const elementoValido = (valor) => (typeof valor === "string" && /^[\w:.-]{1,80}$/.test(valor) ? valor : null);
const sessaoValida = (valor) => (typeof valor === "string" && /^[\w-]{6,64}$/.test(valor) ? valor : null);
// horário informado pelo aparelho, desde que esteja nas últimas 24 h
const momento = (valor, agora) => {
  const ms = Number(valor);
  return Number.isFinite(ms) && ms <= agora + 60000 && ms >= agora - DIA_MS ? Math.min(ms, agora) : agora;
};

function lerComum(item) {
  const rota = normalizarRota(item?.rota);
  if (!rota || !PLATAFORMAS.includes(item.plataforma) || !PERSONAS.includes(item.persona)
      || !DISPOSITIVOS.includes(item.dispositivo)) return null;
  return {
    rota,
    plataforma: item.plataforma,
    persona: item.persona,
    usuarioId: idOuNulo(item.usuarioId),
    farmaciaId: idOuNulo(item.farmaciaId),
    dispositivo: item.dispositivo,
    sessao: sessaoValida(item.sessao),
  };
}

// Recebe o lote { cliques: [...], visitas: [...] }. Itens inválidos são
// ignorados (o resto do lote é salvo). Campos desconhecidos nunca são gravados.
export function registrarLote(dados, agora = Date.now()) {
  const cliques = Array.isArray(dados?.cliques) ? dados.cliques : [];
  const visitas = Array.isArray(dados?.visitas) ? dados.visitas : [];
  if (!cliques.length && !visitas.length) throw erro(400, "Envie uma lista de cliques ou de visitas.");
  if (cliques.length + visitas.length > LIMITE_LOTE) throw erro(413, `Envie no máximo ${LIMITE_LOTE} itens por lote.`);

  const validosCliques = [];
  for (const item of cliques) {
    const comum = lerComum(item);
    const x = Number(item?.x);
    const y = Number(item?.y);
    const largura = inteiro(item?.largura, 100, 10000);
    const altura = inteiro(item?.altura, 100, 10000);
    if (!comum || !(x >= 0 && x <= 1) || !(y >= 0 && y <= 1) || !largura || !altura) continue;
    const interativo = item.interativo === true ? 1 : item.interativo === false ? 0 : null;
    validosCliques.push({ ...comum, x, y, largura, altura, interativo, elemento: elementoValido(item.elemento), em: momento(item.em, agora) });
  }

  const validasVisitas = [];
  for (const item of visitas) {
    const comum = lerComum(item);
    const duracao = inteiro(item?.duracaoMs, 0, 6 * 3600000);
    if (!comum || duracao === null) continue;
    validasVisitas.push({ ...comum, duracao, saida: item.saida === true ? 1 : 0, em: momento(item.em, agora) });
  }

  emTransacao(() => {
    const clique = db.prepare(/*sql*/ `
      INSERT INTO clique_evento (rota, x, y, elemento, interativo, plataforma, persona, usuario_id, farmacia_id,
                                 largura_tela, altura_tela, dispositivo, sessao, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const c of validosCliques) {
      clique.run(c.rota, c.x, c.y, c.elemento, c.interativo, c.plataforma, c.persona, c.usuarioId, c.farmaciaId,
        c.largura, c.altura, c.dispositivo, c.sessao, c.em);
    }
    const visita = db.prepare(/*sql*/ `
      INSERT INTO tela_visita (rota, plataforma, persona, usuario_id, farmacia_id, dispositivo, sessao, duracao_ms, saida, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const v of validasVisitas) {
      visita.run(v.rota, v.plataforma, v.persona, v.usuarioId, v.farmaciaId, v.dispositivo, v.sessao, v.duracao, v.saida, v.em);
    }
  });

  limparCacheAnalytics();
  return {
    cliques: validosCliques.length,
    visitas: validasVisitas.length,
    ignorados: cliques.length + visitas.length - validosCliques.length - validasVisitas.length,
  };
}

// ---------------------------------------------------------------- consultas

// Os resumos do período leem dezenas de milhares de linhas e o painel consulta
// de tempos em tempos: guardam o resultado por 15 s (os alertas nunca).
// Um lote novo de cliques limpa o cache.
const CACHE_MS = 15000;
const cache = new Map();
export function emCache(nome, filtros, calcular) {
  const chave = [nome, filtros.periodo, filtros.periodo === "personalizado" ? `${filtros.inicio}-${filtros.fim}` : "",
    filtros.plataforma ?? "", filtros.farmacia ?? ""].join("|");
  const salvo = cache.get(chave);
  if (salvo && Date.now() - salvo.em < CACHE_MS) return salvo.valor;
  const valor = calcular();
  cache.set(chave, { em: Date.now(), valor });
  if (cache.size > 300) cache.delete(cache.keys().next().value);
  return valor;
}
export function limparCacheAnalytics() {
  cache.clear();
}

const periodoSql = (inicio, fim) => ({ sql: " AND criado_em >= ? AND criado_em < ?", valores: [inicio, fim] });

function onde(filtros, { inicio = filtros.inicio, fim = filtros.fim } = {}, extra = {}) {
  const periodo = periodoSql(inicio, fim);
  const comum = filtroSql(filtros);
  const partes = [periodo.sql, comum.sql];
  const valores = [...periodo.valores, ...comum.valores];
  for (const [coluna, valor] of Object.entries(extra)) {
    if (valor === undefined || valor === null || valor === "") continue;
    partes.push(` AND ${coluna} = ?`);
    valores.push(valor);
  }
  return { sql: `WHERE 1 = 1${partes.join("")}`, valores };
}

// Pontos do mapa de calor de uma rota (agrupados numa grade de 0,5%)
export function pontosDoMapa(filtros, { rota, persona, dispositivo } = {}) {
  const rotaNormal = normalizarRota(rota);
  if (!rotaNormal) throw erro(400, "Informe a rota (ex.: /gerente/chamados).");
  if (persona && !PERSONAS.includes(persona)) throw erro(400, "persona inválida.");
  if (dispositivo && !DISPOSITIVOS.includes(dispositivo)) throw erro(400, "dispositivo deve ser desktop, tablet ou celular.");

  const w = onde(filtros, undefined, { rota: rotaNormal, persona, dispositivo });
  const pontos = db.prepare(/*sql*/ `
    SELECT ROUND(x * 200) / 200.0 AS x, ROUND(y * 200) / 200.0 AS y, COUNT(*) AS peso
    FROM clique_evento ${w.sql}
    GROUP BY 1, 2
  `).all(...w.valores);

  const totais = db.prepare(/*sql*/ `
    SELECT COUNT(*) AS cliques,
           SUM(CASE WHEN interativo = 0 THEN 1 ELSE 0 END) AS semResposta,
           SUM(CASE WHEN interativo IS NULL THEN 1 ELSE 0 END) AS semInformacao
    FROM clique_evento ${w.sql}
  `).get(...w.valores);
  const maisClicado = db.prepare(/*sql*/ `
    SELECT elemento, COUNT(*) AS cliques FROM clique_evento ${w.sql} AND elemento IS NOT NULL
    GROUP BY elemento ORDER BY cliques DESC LIMIT 1
  `).get(...w.valores);
  const porDispositivo = db.prepare(/*sql*/ `
    SELECT dispositivo, COUNT(*) AS cliques FROM clique_evento ${onde(filtros, undefined, { rota: rotaNormal, persona }).sql}
    GROUP BY dispositivo
  `).all(...onde(filtros, undefined, { rota: rotaNormal, persona }).valores);

  const wv = onde(filtros, undefined, { rota: rotaNormal, persona, dispositivo });
  const visitas = db.prepare(`SELECT COUNT(*) AS visitas, AVG(duracao_ms) AS tempoMedio FROM tela_visita ${wv.sql}`).get(...wv.valores);
  const captura = db.prepare("SELECT arquivo, largura, altura, atualizado_em AS atualizadoEm FROM tela_captura WHERE rota = ?").get(rotaNormal);

  return {
    rota: rotaNormal,
    pontos,
    cliques: totais.cliques,
    semResposta: totais.semResposta ?? 0,
    // no app não dá para saber se o toque foi num botão
    semInformacao: totais.semInformacao ?? 0,
    elementoMaisClicado: maisClicado ? { elemento: maisClicado.elemento, cliques: maisClicado.cliques } : null,
    visitas: visitas.visitas,
    tempoMedioMs: visitas.tempoMedio === null ? null : Math.round(visitas.tempoMedio),
    porDispositivo: Object.fromEntries(porDispositivo.map((d) => [d.dispositivo, d.cliques])),
    captura: captura ? { ...captura, url: `/uploads/telas/${captura.arquivo}` } : null,
  };
}

// Ranking de rotas: visitas, cliques, tempo médio e abandono
export function rankingRotas(filtros) {
  return emCache("ranking", filtros, () => calcularRanking(filtros));
}

function calcularRanking(filtros) {
  const w = onde(filtros);
  const visitas = db.prepare(/*sql*/ `
    SELECT rota, plataforma, COUNT(*) AS visitas, AVG(duracao_ms) AS tempoMedio, SUM(saida) AS saidas
    FROM tela_visita ${w.sql} GROUP BY rota, plataforma
  `).all(...w.valores);
  const cliques = db.prepare(/*sql*/ `
    SELECT rota, plataforma, COUNT(*) AS cliques, SUM(CASE WHEN interativo = 0 THEN 1 ELSE 0 END) AS semResposta
    FROM clique_evento ${w.sql} GROUP BY rota, plataforma
  `).all(...w.valores);

  const porChave = new Map();
  const linha = (rota, plataforma) => {
    const chave = `${plataforma} ${rota}`;
    if (!porChave.has(chave)) {
      porChave.set(chave, { rota, plataforma, visitas: 0, cliques: 0, semResposta: 0, tempoMedioMs: null, taxaAbandono: null });
    }
    return porChave.get(chave);
  };
  for (const v of visitas) {
    Object.assign(linha(v.rota, v.plataforma), {
      visitas: v.visitas,
      tempoMedioMs: Math.round(v.tempoMedio),
      taxaAbandono: v.visitas ? Math.round((v.saidas / v.visitas) * 1000) / 10 : null,
    });
  }
  for (const c of cliques) Object.assign(linha(c.rota, c.plataforma), { cliques: c.cliques, semResposta: c.semResposta });

  return [...porChave.values()].sort((a, b) => b.visitas - a.visitas || b.cliques - a.cliques);
}

// identidade de quem usou: pessoa logada ou, sem login, a sessão do aparelho
const PESSOA = "COALESCE(persona || ':' || usuario_id, 'sessao:' || sessao, 'anonimo')";

function usuariosAtivos(filtros, intervalo) {
  const w = onde(filtros, intervalo);
  return db.prepare(/*sql*/ `
    SELECT COUNT(DISTINCT pessoa) AS total FROM (
      SELECT ${PESSOA} AS pessoa FROM clique_evento ${w.sql}
      UNION SELECT ${PESSOA} FROM tela_visita ${w.sql})
  `).get(...w.valores, ...w.valores).total;
}

function totalCliques(filtros, intervalo) {
  const w = onde(filtros, intervalo);
  return db.prepare(`SELECT COUNT(*) AS total FROM clique_evento ${w.sql}`).get(...w.valores).total;
}

// requisições: a farmácia não se aplica (a API é uma só para a rede)
function requisicoes(filtros, intervalo) {
  const w = onde({ ...filtros, farmacia: null }, intervalo);
  const r = db.prepare(/*sql*/ `
    SELECT COUNT(*) AS total, SUM(CASE WHEN status >= 500 THEN 1 ELSE 0 END) AS erros, AVG(duracao_ms) AS tempoMedio
    FROM requisicao_log ${w.sql}
  `).get(...w.valores);
  return {
    total: r.total,
    erros: r.erros ?? 0,
    taxaErro: r.total ? Math.round(((r.erros ?? 0) / r.total) * 1000) / 10 : null,
    tempoMedioMs: r.tempoMedio === null ? null : Math.round(r.tempoMedio),
  };
}

// grade de horários do gráfico (por hora ou por dia, conforme o período)
// faixa que termina depois do fim do período ainda está acontecendo (ex.: hoje)
export const faixaParcial = (inicio, filtros) => inicio + filtros.passo > filtros.fim;

export function grade(filtros) {
  const pontos = [];
  for (let t = filtros.inicio; t < filtros.fim; t += filtros.passo) pontos.push(t);
  return pontos;
}

export function serieRequisicoes(filtros) {
  const w = onde({ ...filtros, farmacia: null });
  const linhas = db.prepare(/*sql*/ `
    SELECT CAST((criado_em - ?) / ? AS INTEGER) AS faixa, COUNT(*) AS requisicoes,
           SUM(CASE WHEN status >= 500 THEN 1 ELSE 0 END) AS erros
    FROM requisicao_log ${w.sql} GROUP BY faixa
  `).all(filtros.inicio, filtros.passo, ...w.valores);
  const porFaixa = new Map(linhas.map((l) => [Number(l.faixa), l]));
  return grade(filtros).map((inicio, i) => ({
    inicio,
    parcial: faixaParcial(inicio, filtros),
    requisicoes: porFaixa.get(i)?.requisicoes ?? 0,
    erros: porFaixa.get(i)?.erros ?? 0,
  }));
}

// Visão geral: 4 indicadores (com o período anterior), 2 gráficos e alertas
export function resumoGeral(filtros) {
  const { alertas } = listarAlertas({ status: "ativo" });
  return {
    ...emCache("resumo", filtros, () => calcularResumo(filtros)),
    alertas: alertas.slice(0, 3),
    totalAlertas: alertas.length,
  };
}

function calcularResumo(filtros) {
  const anterior = filtros.anterior;
  const atualReq = requisicoes(filtros);
  const antesReq = requisicoes(filtros, anterior);
  const indicador = (atual, antes) => ({ valor: atual, anterior: antes, variacao: variacao(atual, antes) });

  const usuarios = usuariosAtivos(filtros);
  const cliques = totalCliques(filtros);
  const maisAcessadas = rankingRotas(filtros).slice(0, 5).map(({ rota, plataforma, visitas, cliques: c }) => ({ rota, plataforma, visitas, cliques: c }));

  return {
    comparacao: filtros.comparacao,
    indicadores: {
      usuariosAtivos: indicador(usuarios, usuariosAtivos(filtros, anterior)),
      cliques: indicador(cliques, totalCliques(filtros, anterior)),
      taxaErro: indicador(atualReq.taxaErro, antesReq.taxaErro),
      tempoMedioMs: indicador(atualReq.tempoMedioMs, antesReq.tempoMedioMs),
    },
    requisicoes: { total: atualReq.total, erros: atualReq.erros },
    serie: serieRequisicoes(filtros),
    passo: filtros.passo,
    maisAcessadas,
  };
}

// ------------------------------------------------- capturas das telas do app

export function listarCapturas() {
  return db.prepare("SELECT rota, arquivo, largura, altura, atualizado_em AS atualizadoEm FROM tela_captura ORDER BY rota")
    .all()
    .map((c) => ({ ...c, url: `/uploads/telas/${c.arquivo}` }));
}

// salva a captura e devolve o arquivo antigo (para o controller apagar)
export function salvarCaptura({ rota, arquivo, largura = null, altura = null }, agora = Date.now()) {
  const rotaNormal = normalizarRota(rota);
  if (!rotaNormal) throw erro(400, "Informe a rota da tela (ex.: ?rota=/pesquisa).");
  const antiga = db.prepare("SELECT arquivo FROM tela_captura WHERE rota = ?").get(rotaNormal)?.arquivo ?? null;
  db.prepare(/*sql*/ `
    INSERT INTO tela_captura (rota, arquivo, largura, altura, atualizado_em) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (rota) DO UPDATE SET arquivo = excluded.arquivo, largura = excluded.largura,
      altura = excluded.altura, atualizado_em = excluded.atualizado_em
  `).run(rotaNormal, arquivo, inteiro(largura, 100, 10000), inteiro(altura, 100, 10000), agora);
  return { rota: rotaNormal, arquivo, antiga, url: `/uploads/telas/${arquivo}` };
}
