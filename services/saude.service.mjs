import db from "../database/database.mjs";
import { grade } from "./analytics.service.mjs";
import { listarAlertas } from "./alerta.service.mjs";
import { estadoMonitor, sondarBanco } from "./monitor.service.mjs";

// Sub-aba "Saúde do sistema": status geral em uma frase, tempo de resposta,
// rotas com mais erros e os últimos erros. A farmácia não se aplica aqui
// (a API é uma só para a rede toda); a plataforma sim.

const LIMITE_PARA_P95 = 200000; // acima disso o gráfico mostra só a média

const percentil = (valores, p) => {
  if (!valores.length) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  return ordenados[Math.min(ordenados.length - 1, Math.ceil((p / 100) * ordenados.length) - 1)];
};

function ondeRequisicoes(filtros) {
  const valores = [filtros.inicio, filtros.fim];
  let sql = "WHERE criado_em >= ? AND criado_em < ?";
  if (filtros.plataforma) {
    sql += " AND plataforma = ?";
    valores.push(filtros.plataforma);
  }
  return { sql, valores };
}

export function painelSaude(filtros) {
  const w = ondeRequisicoes(filtros);
  const { alertas, bancoDisponivel } = listarAlertas({ status: "ativo" });
  const sonda = sondarBanco();
  const monitor = estadoMonitor();

  const totais = db.prepare(/*sql*/ `
    SELECT COUNT(*) AS total, SUM(CASE WHEN status >= 500 THEN 1 ELSE 0 END) AS erros, AVG(duracao_ms) AS tempoMedio
    FROM requisicao_log ${w.sql}
  `).get(...w.valores);

  // tempo de resposta: média e p95 (as 5% respostas mais lentas) por faixa
  const usarP95 = totais.total <= LIMITE_PARA_P95;
  const porFaixa = new Map();
  if (usarP95) {
    for (const { faixa, duracao } of db.prepare(`SELECT CAST((criado_em - ?) / ? AS INTEGER) AS faixa, duracao_ms AS duracao FROM requisicao_log ${w.sql}`)
      .iterate(filtros.inicio, filtros.passo, ...w.valores)) {
      const chave = Number(faixa);
      if (!porFaixa.has(chave)) porFaixa.set(chave, []);
      porFaixa.get(chave).push(duracao);
    }
  } else {
    for (const linha of db.prepare(`SELECT CAST((criado_em - ?) / ? AS INTEGER) AS faixa, AVG(duracao_ms) AS media FROM requisicao_log ${w.sql} GROUP BY faixa`)
      .all(filtros.inicio, filtros.passo, ...w.valores)) {
      porFaixa.set(Number(linha.faixa), linha.media);
    }
  }
  const tempoResposta = grade(filtros).map((inicio, i) => {
    const valor = porFaixa.get(i);
    if (valor === undefined) return { inicio, mediaMs: null, p95Ms: null };
    if (!Array.isArray(valor)) return { inicio, mediaMs: Math.round(valor), p95Ms: null };
    return {
      inicio,
      mediaMs: Math.round(valor.reduce((s, v) => s + v, 0) / valor.length),
      p95Ms: Math.round(percentil(valor, 95)),
    };
  });

  const rotasComErro = db.prepare(/*sql*/ `
    SELECT metodo, rota, COUNT(*) AS total, SUM(CASE WHEN status >= 500 THEN 1 ELSE 0 END) AS erros
    FROM requisicao_log ${w.sql}
    GROUP BY metodo, rota HAVING erros > 0
    ORDER BY erros DESC LIMIT 6
  `).all(...w.valores).map((r) => ({ ...r, taxa: Math.round((r.erros / r.total) * 1000) / 10 }));

  const ultimosErros = db.prepare(/*sql*/ `
    SELECT id, mensagem, rota, metodo, criado_em AS criadoEm FROM erro_log
    WHERE criado_em >= ? AND criado_em < ? ORDER BY id DESC LIMIT 10
  `).all(filtros.inicio, filtros.fim);

  // banco com problema que ainda não virou alerta (a verificação é a cada 1 min)
  const bancoSemAlerta = !sonda.ok && !alertas.some((a) => a.tipo === "banco");
  const problemas = alertas.length + (bancoSemAlerta ? 1 : 0);
  const criticos = alertas.filter((a) => a.severidade === "critico").length;

  return {
    status: {
      ok: problemas === 0,
      problemas,
      criticos,
      frase: problemas === 0
        ? "Tudo funcionando"
        : `${problemas} ${problemas === 1 ? "problema precisa" : "problemas precisam"} de atenção`,
    },
    banco: { ok: sonda.ok, ms: Math.round(sonda.ms * 10) / 10, mensagem: sonda.mensagem ?? null, alertasNoBanco: bancoDisponivel },
    monitor,
    totais: {
      requisicoes: totais.total,
      erros: totais.erros ?? 0,
      taxaErro: totais.total ? Math.round(((totais.erros ?? 0) / totais.total) * 1000) / 10 : null,
      tempoMedioMs: totais.tempoMedio === null ? null : Math.round(totais.tempoMedio),
    },
    passo: filtros.passo,
    tempoResposta,
    rotasComErro,
    ultimosErros,
  };
}
