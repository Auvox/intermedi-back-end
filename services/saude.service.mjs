import db from "../database/database.mjs";
import { emCache, faixaParcial, grade } from "./analytics.service.mjs";
import { listarAlertas } from "./alerta.service.mjs";
import { estadoMonitor, sondarBanco } from "./monitor.service.mjs";

// Sub-aba "Saúde do sistema": status geral em uma frase, tempo de resposta,
// rotas com mais erros e os últimos erros. A farmácia não se aplica aqui
// (a API é uma só para a rede toda); a plataforma sim.

function ondeRequisicoes(filtros) {
  const valores = [filtros.inicio, filtros.fim];
  let sql = "WHERE criado_em >= ? AND criado_em < ?";
  if (filtros.plataforma) {
    sql += " AND plataforma = ?";
    valores.push(filtros.plataforma);
  }
  return { sql, valores };
}

// as somas do período ficam 15 s em cache; banco, alertas e últimos erros, nunca
function agregados(filtros) {
  const w = ondeRequisicoes(filtros);
  const totais = db.prepare(/*sql*/ `
    SELECT COUNT(*) AS total, SUM(CASE WHEN status >= 500 THEN 1 ELSE 0 END) AS erros, AVG(duracao_ms) AS tempoMedio
    FROM requisicao_log ${w.sql}
  `).get(...w.valores);

  // tempo de resposta por faixa: média e p95 (as 5% respostas mais lentas).
  // O banco devolve um histograma (quantas respostas levaram cada ms) e o p95
  // sai dele somando as faixas até chegar a 95%; é bem mais leve que ordenar tudo.
  const porFaixa = new Map();
  const histograma = db.prepare(/*sql*/ `
    SELECT CAST((criado_em - ?) / ? AS INTEGER) AS faixa, CAST(duracao_ms AS INTEGER) AS ms,
           COUNT(*) AS n, SUM(duracao_ms) AS soma
    FROM requisicao_log ${w.sql}
    GROUP BY faixa, ms ORDER BY faixa, ms
  `).all(filtros.inicio, filtros.passo, ...w.valores);
  for (const linha of histograma) {
    const faixa = porFaixa.get(linha.faixa) ?? { total: 0, soma: 0, contagens: [] };
    faixa.total += linha.n;
    faixa.soma += linha.soma;
    faixa.contagens.push(linha);
    porFaixa.set(linha.faixa, faixa);
  }
  const tempoResposta = grade(filtros).map((inicio, i) => {
    const faixa = porFaixa.get(i);
    const parcial = faixaParcial(inicio, filtros);
    if (!faixa) return { inicio, parcial, mediaMs: null, p95Ms: null };
    let acumulado = 0;
    const p95 = faixa.contagens.find((c) => (acumulado += c.n) * 100 >= faixa.total * 95);
    return { inicio, parcial, mediaMs: Math.round(faixa.soma / faixa.total), p95Ms: p95.ms };
  });

  const rotasComErro = db.prepare(/*sql*/ `
    SELECT metodo, rota, COUNT(*) AS total, SUM(CASE WHEN status >= 500 THEN 1 ELSE 0 END) AS erros
    FROM requisicao_log ${w.sql}
    GROUP BY metodo, rota HAVING erros > 0
    ORDER BY erros DESC LIMIT 6
  `).all(...w.valores).map((r) => ({ ...r, taxa: Math.round((r.erros / r.total) * 1000) / 10 }));

  return {
    totais: {
      requisicoes: totais.total,
      erros: totais.erros ?? 0,
      taxaErro: totais.total ? Math.round(((totais.erros ?? 0) / totais.total) * 1000) / 10 : null,
      tempoMedioMs: totais.tempoMedio === null ? null : Math.round(totais.tempoMedio),
    },
    tempoResposta,
    rotasComErro,
  };
}

export function painelSaude(filtros) {
  const { alertas, bancoDisponivel } = listarAlertas({ status: "ativo" });
  const sonda = sondarBanco();
  const monitor = estadoMonitor();
  const { totais, tempoResposta, rotasComErro } = emCache("saude", filtros, () => agregados(filtros));

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
    totais,
    passo: filtros.passo,
    tempoResposta,
    rotasComErro,
    ultimosErros,
  };
}
