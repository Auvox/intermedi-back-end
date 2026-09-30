import db, { emTransacao } from "../database/database.mjs";
import { erro } from "../utils/http.mjs";
import { texto, textoOuNull } from "../utils/dados.mjs";

// Pedidos de remédio entre farmácias, gerados quando o gerente aceita um chamado.
//   origem  = farmácia FORNECEDORA (recebe a notificação e aceita/recusa)
//   destino = farmácia SOLICITANTE (dona do chamado)

// Tempo que o remédio leva para chegar depois que o fornecedor aceita
export const TEMPO_ENTREGA_SEGUNDOS = Number(process.env.INTERMEDI_TEMPO_ENTREGA_SEGUNDOS ?? 120);

const STATUS = ["solicitada", "aprovada", "enviada", "recebida", "recusada", "cancelada"];

const SELECT_REDISTRIBUICAO = /*sql*/ `
  SELECT
      rd.id_redistribuicao     AS idRedistribuicao,
      rd.id_chamado            AS idChamado,
      rd.status                AS status,
      rd.quantidade            AS quantidade,
      r.id_remedio             AS idRemedio,
      r.nome                   AS nomeRemedio,
      r.dosagem                AS dosagemRemedio,
      r.tarja                  AS tarjaRemedio,
      r.foto                   AS fotoRemedio,
      fo.id_farmacia           AS idFarmaciaOrigem,
      fo.nome                  AS nomeFarmaciaOrigem,
      fd.id_farmacia           AS idFarmaciaDestino,
      fd.nome                  AS nomeFarmaciaDestino,
      gs.id_gerente            AS idGerenteSolicitante,
      gs.nome                  AS nomeGerenteSolicitante,
      rd.id_gerente_resposta   AS idGerenteResposta,
      gr.nome                  AS nomeGerenteResposta,
      rd.motivo_recusa         AS motivoRecusa,
      rd.data_solicitacao      AS dataSolicitacao,
      rd.data_aprovacao        AS dataAprovacao,
      rd.data_recusa           AS dataRecusa,
      rd.data_envio            AS dataEnvio,
      rd.data_prevista_chegada AS dataPrevistaChegada,
      rd.data_recebimento      AS dataRecebimento,
      es.quantidade            AS estoqueOrigem,
      es.estoque_minimo        AS estoqueMinimoOrigem
  FROM redistribuicao rd
  INNER JOIN remedio  r  ON r.id_remedio   = rd.id_remedio
  INNER JOIN farmacia fo ON fo.id_farmacia = rd.id_farmacia_origem
  INNER JOIN farmacia fd ON fd.id_farmacia = rd.id_farmacia_destino
  LEFT  JOIN chamado  ch ON ch.id_chamado  = rd.id_chamado
  LEFT  JOIN gerente  gs ON gs.id_gerente  = ch.id_gerente_resposta
  LEFT  JOIN gerente  gr ON gr.id_gerente  = rd.id_gerente_resposta
  LEFT  JOIN estoque  es ON es.id_remedio  = rd.id_remedio AND es.id_farmacia = rd.id_farmacia_origem
`;

// "2026-09-30 18:00:00" (UTC do SQLite) -> milissegundos
const emMs = (data) => Date.parse(`${data.replace(" ", "T")}Z`);

const formatar = (linha) => {
  if (!linha) return linha;
  const quem = linha.nomeGerenteSolicitante
    ? `${linha.nomeGerenteSolicitante} (${linha.nomeFarmaciaDestino})`
    : linha.nomeFarmaciaDestino;
  return {
    ...linha,
    // texto pronto para a notificação do gerente fornecedor
    mensagem: `${quem} está precisando de ${linha.quantidade}× ${linha.nomeRemedio} ${linha.dosagemRemedio ?? ""}`.trim(),
    // para o front mostrar a contagem regressiva da entrega
    segundosParaChegar: linha.status === "enviada" && linha.dataPrevistaChegada
      ? Math.max(0, Math.ceil((emMs(linha.dataPrevistaChegada) - Date.now()) / 1000))
      : null,
  };
};

export function buscarPorId(idRedistribuicao) {
  processarChegadas();
  return formatar(
    db.prepare(`${SELECT_REDISTRIBUICAO} WHERE rd.id_redistribuicao = ?`).get(idRedistribuicao),
  );
}

// ---------------------------------------------------------------------
//  Escolha da farmácia fornecedora
// ---------------------------------------------------------------------

// Farmácias que têm o remédio (menos a solicitante), da que mais tem sobrando
// para a que menos tem. disponivel = quantidade - estoque mínimo.
export function farmaciasComRemedio(idRemedio, idFarmaciaSolicitante) {
  return db.prepare(/*sql*/ `
    SELECT
        f.id_farmacia                          AS idFarmacia,
        f.nome                                 AS nomeFarmacia,
        es.quantidade                          AS quantidade,
        es.estoque_minimo                      AS estoqueMinimo,
        MAX(es.quantidade - es.estoque_minimo, 0) AS disponivel,
        (es.validade IS NOT NULL AND es.validade < date('now', 'localtime')) AS vencido
    FROM estoque es
    INNER JOIN farmacia f ON f.id_farmacia = es.id_farmacia
    WHERE es.id_remedio = ? AND es.id_farmacia <> ?
    ORDER BY disponivel DESC, f.nome
  `).all(idRemedio, idFarmaciaSolicitante).map((f) => ({ ...f, vencido: Boolean(f.vencido) }));
}

// Farmácias que podem mandar a quantidade toda sem ficar abaixo do mínimo
// e que ainda não recusaram este item deste chamado
function candidatas(idChamado, idRemedio, idFarmaciaSolicitante, quantidade) {
  const recusaram = new Set(db.prepare(/*sql*/ `
    SELECT id_farmacia_origem AS id FROM redistribuicao
    WHERE id_chamado = ? AND id_remedio = ? AND status = 'recusada'
  `).all(idChamado, idRemedio).map((linha) => linha.id));

  return farmaciasComRemedio(idRemedio, idFarmaciaSolicitante)
    .filter((f) => !f.vencido && f.disponivel >= quantidade && !recusaram.has(f.idFarmacia));
}

function criarPedido(idChamado, idRemedio, idOrigem, idDestino, quantidade) {
  const { lastInsertRowid } = db.prepare(/*sql*/ `
    INSERT INTO redistribuicao (id_chamado, id_remedio, id_farmacia_origem, id_farmacia_destino, quantidade)
    VALUES (?, ?, ?, ?, ?)
  `).run(idChamado, idRemedio, idOrigem, idDestino, quantidade);
  return Number(lastInsertRowid);
}

// Item do chamado que ainda não tem pedido ativo (solicitada/aprovada/enviada/recebida)
function itensSemPedidoAtivo(idChamado) {
  return db.prepare(/*sql*/ `
    SELECT cr.id_remedio AS idRemedio, cr.quantidade, r.nome AS nomeRemedio
    FROM chamado_remedio cr
    INNER JOIN remedio r ON r.id_remedio = cr.id_remedio
    WHERE cr.id_chamado = ?
      AND NOT EXISTS (
        SELECT 1 FROM redistribuicao rd
        WHERE rd.id_chamado = cr.id_chamado AND rd.id_remedio = cr.id_remedio
          AND rd.status IN ('solicitada', 'aprovada', 'enviada', 'recebida'))
    ORDER BY r.nome
  `).all(idChamado);
}

// Envia os pedidos do chamado para as farmácias.
// Num "pacote", prefere a farmácia que consegue atender MAIS itens do chamado
// (menos entregas); no empate, a que tem mais sobrando.
// Pode ser chamada de novo: só cria pedido para itens que ainda não têm.
export function despachar(idChamado) {
  const chamado = db.prepare("SELECT id_farmacia FROM chamado WHERE id_chamado = ?").get(idChamado);
  const itens = itensSemPedidoAtivo(idChamado).map((item) => ({
    ...item,
    opcoes: candidatas(idChamado, item.idRemedio, chamado.id_farmacia, item.quantidade ?? 1),
  }));

  const cobertura = new Map();
  for (const item of itens) {
    for (const opcao of item.opcoes) cobertura.set(opcao.idFarmacia, (cobertura.get(opcao.idFarmacia) ?? 0) + 1);
  }

  return itens.map((item) => {
    const [escolhida] = [...item.opcoes].sort((a, b) =>
      cobertura.get(b.idFarmacia) - cobertura.get(a.idFarmacia) || b.disponivel - a.disponivel);
    if (!escolhida) return { idRemedio: item.idRemedio, nomeRemedio: item.nomeRemedio, enviadoPara: null };

    const idRedistribuicao = criarPedido(
      idChamado, item.idRemedio, escolhida.idFarmacia, chamado.id_farmacia, item.quantidade ?? 1);
    return {
      idRemedio: item.idRemedio,
      nomeRemedio: item.nomeRemedio,
      idRedistribuicao,
      enviadoPara: { idFarmacia: escolhida.idFarmacia, nomeFarmacia: escolhida.nomeFarmacia },
    };
  });
}

// ---------------------------------------------------------------------
//  Resposta da farmácia fornecedora
// ---------------------------------------------------------------------

// Gerente da farmácia fornecedora aceita (remédio sai do estoque e fica
// "a caminho") ou recusa (pedido passa automaticamente para outra farmácia)
export function responder(idRedistribuicao, data) {
  const idGerente = Number(data.idGerente);
  if (!Number.isInteger(idGerente) || idGerente <= 0) throw erro(400, "Informe idGerente.");
  if (typeof data.aceitar !== "boolean") throw erro(400, "Informe aceitar: true ou false.");

  return emTransacao(() => {
    const pedido = db.prepare("SELECT * FROM redistribuicao WHERE id_redistribuicao = ?").get(idRedistribuicao);
    if (!pedido) throw erro(404, "Pedido não encontrado");

    const gerente = db.prepare("SELECT id_farmacia FROM gerente WHERE id_gerente = ?").get(idGerente);
    if (!gerente) throw erro(404, "Gerente não encontrado");
    if (gerente.id_farmacia !== pedido.id_farmacia_origem) {
      throw erro(403, "Este pedido foi enviado para outra farmácia.");
    }
    if (pedido.status !== "solicitada") {
      throw erro(409, `Este pedido já foi respondido (status: ${pedido.status}).`);
    }

    if (data.aceitar) {
      const estoque = db.prepare(/*sql*/ `
        SELECT id_estoque, quantidade, (validade IS NOT NULL AND validade < date('now', 'localtime')) AS vencido
        FROM estoque WHERE id_remedio = ? AND id_farmacia = ?
      `).get(pedido.id_remedio, pedido.id_farmacia_origem);
      if (!estoque || estoque.quantidade < pedido.quantidade) {
        throw erro(409, `Sua farmácia não tem ${pedido.quantidade} unidades para enviar ` +
          `(disponível: ${estoque?.quantidade ?? 0}). Recuse o pedido para ele seguir para outra farmácia.`);
      }
      if (estoque.vencido) throw erro(409, "O lote deste remédio está vencido. Recuse o pedido.");

      // sai do estoque do fornecedor na hora (o remédio já foi despachado)
      db.prepare(/*sql*/ `
        UPDATE estoque SET quantidade = quantidade - ?, updated_at = CURRENT_TIMESTAMP WHERE id_estoque = ?
      `).run(pedido.quantidade, estoque.id_estoque);

      db.prepare(/*sql*/ `
        UPDATE redistribuicao
        SET status = 'enviada', id_gerente_resposta = ?, data_aprovacao = CURRENT_TIMESTAMP,
            data_envio = CURRENT_TIMESTAMP,
            data_prevista_chegada = datetime('now', ?)
        WHERE id_redistribuicao = ?
      `).run(idGerente, `+${TEMPO_ENTREGA_SEGUNDOS} seconds`, idRedistribuicao);

      return { pedido: buscarPorId(idRedistribuicao), encaminhadoPara: null };
    }

    db.prepare(/*sql*/ `
      UPDATE redistribuicao
      SET status = 'recusada', id_gerente_resposta = ?, motivo_recusa = ?, data_recusa = CURRENT_TIMESTAMP
      WHERE id_redistribuicao = ?
    `).run(idGerente, textoOuNull(data.motivo), idRedistribuicao);

    // recusou: procura a próxima farmácia que tem o remédio
    let encaminhadoPara = null;
    if (pedido.id_chamado) {
      const [proxima] = candidatas(pedido.id_chamado, pedido.id_remedio, pedido.id_farmacia_destino, pedido.quantidade);
      if (proxima) {
        const idNovo = criarPedido(pedido.id_chamado, pedido.id_remedio, proxima.idFarmacia,
          pedido.id_farmacia_destino, pedido.quantidade);
        encaminhadoPara = { idRedistribuicao: idNovo, idFarmacia: proxima.idFarmacia, nomeFarmacia: proxima.nomeFarmacia };
      }
    }
    return { pedido: buscarPorId(idRedistribuicao), encaminhadoPara };
  });
}

// ---------------------------------------------------------------------
//  Chegada do remédio (depois do tempo de entrega)
// ---------------------------------------------------------------------

// Dá entrada no estoque da farmácia solicitante para tudo que já chegou.
// Roda num intervalo (iniciarEntregas) e também antes das consultas, para a
// resposta nunca mostrar um pedido "atrasado".
// agora: opcional ("AAAA-MM-DD HH:MM:SS" em UTC), usado nos testes.
export function processarChegadas(agora = null) {
  const chegaram = db.prepare(/*sql*/ `
    SELECT * FROM redistribuicao
    WHERE status = 'enviada' AND data_prevista_chegada IS NOT NULL
      AND data_prevista_chegada <= COALESCE(?, datetime('now'))
    ORDER BY data_prevista_chegada
  `).all(agora);

  for (const pedido of chegaram) {
    emTransacao(() => {
      const { changes } = db.prepare(/*sql*/ `
        UPDATE redistribuicao SET status = 'recebida', data_recebimento = data_prevista_chegada
        WHERE id_redistribuicao = ? AND status = 'enviada'
      `).run(pedido.id_redistribuicao);
      if (changes === 0) return;

      // se a farmácia ainda não tinha o remédio, cria a linha com o lote/validade da origem
      const origem = db.prepare("SELECT lote, validade FROM estoque WHERE id_remedio = ? AND id_farmacia = ?")
        .get(pedido.id_remedio, pedido.id_farmacia_origem);
      db.prepare(/*sql*/ `
        INSERT INTO estoque (id_remedio, id_farmacia, quantidade, lote, validade)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (id_remedio, id_farmacia)
        DO UPDATE SET quantidade = quantidade + excluded.quantidade, updated_at = CURRENT_TIMESTAMP
      `).run(pedido.id_remedio, pedido.id_farmacia_destino, pedido.quantidade,
        origem?.lote ?? null, origem?.validade ?? null);

      // chamado resolvido quando TODOS os remédios dele chegaram
      if (pedido.id_chamado) {
        const faltando = db.prepare(/*sql*/ `
          SELECT COUNT(*) AS total FROM chamado_remedio cr
          WHERE cr.id_chamado = ? AND NOT EXISTS (
            SELECT 1 FROM redistribuicao rd
            WHERE rd.id_chamado = cr.id_chamado AND rd.id_remedio = cr.id_remedio AND rd.status = 'recebida')
        `).get(pedido.id_chamado).total;
        if (faltando === 0) {
          db.prepare("UPDATE chamado SET status = 'resolvido' WHERE id_chamado = ? AND status = 'em_andamento'")
            .run(pedido.id_chamado);
        }
      }
    });
  }
  return chegaram.length;
}

let intervalo = null;
export function iniciarEntregas(cadaMs = 5000) {
  if (intervalo) return;
  intervalo = setInterval(() => {
    try {
      const total = processarChegadas();
      if (total) console.log(`${total} entrega(s) de redistribuição recebida(s).`);
    } catch (error) {
      console.error("Erro ao processar entregas:", error);
    }
  }, cadaMs);
  intervalo.unref();
}

// ---------------------------------------------------------------------
//  Listagens
// ---------------------------------------------------------------------

// tipo = recebidos -> pedidos que OUTRAS farmácias fizeram para a farmácia do gerente (notificações)
// tipo = enviados  -> pedidos que a farmácia do gerente fez (acompanhar a entrega)
export function listarDoGerente(idGerente, { tipo, status } = {}) {
  processarChegadas();
  const gerente = db.prepare("SELECT id_farmacia FROM gerente WHERE id_gerente = ?").get(idGerente);
  if (!gerente) throw erro(404, "Gerente não encontrado");

  const qual = texto(tipo).toLowerCase() || "recebidos";
  if (!["recebidos", "enviados"].includes(qual)) throw erro(400, "tipo inválido. Use: recebidos ou enviados.");
  const filtro = texto(status).toLowerCase() || null;
  if (filtro && !STATUS.includes(filtro)) throw erro(400, `status inválido. Use: ${STATUS.join(", ")}.`);

  const coluna = qual === "recebidos" ? "rd.id_farmacia_origem" : "rd.id_farmacia_destino";
  const pedidos = db.prepare(/*sql*/ `
    ${SELECT_REDISTRIBUICAO}
    WHERE ${coluna} = ? AND (? IS NULL OR rd.status = ?)
    ORDER BY rd.status = 'solicitada' DESC, rd.status = 'enviada' DESC,
             rd.data_solicitacao DESC, rd.id_redistribuicao DESC
  `).all(gerente.id_farmacia, filtro, filtro).map(formatar);

  const { total } = db.prepare(/*sql*/ `
    SELECT COUNT(*) AS total FROM redistribuicao WHERE id_farmacia_origem = ? AND status = 'solicitada'
  `).get(gerente.id_farmacia);

  return { tipo: qual, totalPendentes: total, pedidos };
}

// Histórico de pedidos de um chamado (todas as tentativas)
export function pedidosDoChamado(idChamado) {
  return db.prepare(`${SELECT_REDISTRIBUICAO} WHERE rd.id_chamado = ? ORDER BY rd.id_redistribuicao`)
    .all(idChamado).map(formatar);
}
