import db, { emTransacao } from "../database/database.mjs";
import { erro } from "../utils/http.mjs";
import { texto, textoOuNull } from "../utils/dados.mjs";
import { despachar, farmaciasComRemedio, pedidosDoChamado, processarChegadas } from "./redistribuicao.service.mjs";

// Estoque mínimo padrão, usado quando o remédio ainda não está no estoque da
// farmácia (quem está usa o estoque_minimo definido pelo gerente)
export const ESTOQUE_CRITICO = 20;

const PRIORIDADES = ["baixa", "media", "alta", "urgente"];
const STATUS = ["pendente", "aceito", "em_andamento", "resolvido", "recusado", "cancelado"];

// Lê a lista [{ idRemedio, quantidade }] enviada pelo funcionário
function lerRemedios(remedios) {
  if (!Array.isArray(remedios) || remedios.length === 0) {
    throw erro(400, "Informe remedios: [{ idRemedio, quantidade }].");
  }

  const itens = remedios.map((item) => ({
    idRemedio: Number(item?.idRemedio),
    quantidade: Number(item?.quantidade),
  }));

  if (itens.some((i) => !Number.isInteger(i.idRemedio) || i.idRemedio <= 0)) {
    throw erro(400, "idRemedio inválido.");
  }
  if (itens.some((i) => !Number.isInteger(i.quantidade) || i.quantidade <= 0)) {
    throw erro(400, "quantidade deve ser um número inteiro maior que zero.");
  }
  if (new Set(itens.map((i) => i.idRemedio)).size !== itens.length) {
    throw erro(400, "O mesmo remédio foi informado mais de uma vez.");
  }
  return itens;
}

function lerPrioridade(valor) {
  const prioridade = texto(valor).toLowerCase() || "media";
  if (!PRIORIDADES.includes(prioridade)) {
    throw erro(400, `Prioridade inválida. Use: ${PRIORIDADES.join(", ")}.`);
  }
  return prioridade;
}

// Remédios do chamado com o estoque atual da farmácia
function remediosDoChamado(idChamado, idFarmacia) {
  return db.prepare(/*sql*/ `
    SELECT
        r.id_remedio                    AS idRemedio,
        r.nome                          AS nomeRemedio,
        r.dosagem                       AS dosagemRemedio,
        cr.quantidade                   AS quantidadeSolicitada,
        COALESCE(es.quantidade, 0)      AS estoqueAtual,
        COALESCE(es.estoque_minimo, ?)  AS estoqueMinimo
    FROM chamado_remedio cr
    INNER JOIN remedio r ON r.id_remedio = cr.id_remedio
    LEFT  JOIN estoque es ON es.id_remedio = r.id_remedio AND es.id_farmacia = ?
    WHERE cr.id_chamado = ?
    ORDER BY r.nome
  `).all(ESTOQUE_CRITICO, idFarmacia, idChamado)
    .map((r) => ({ ...r, critico: r.estoqueAtual <= r.estoqueMinimo }));
}

// Situação de cada remédio do chamado, olhando o pedido mais recente dele:
//   aguardando_gerente    -> o gerente ainda não aceitou o chamado
//   aguardando_fornecedor -> pedido enviado, esperando a outra farmácia responder
//   a_caminho             -> fornecedor aceitou, remédio em trânsito
//   recebido              -> chegou e entrou no estoque
//   sem_fornecedor        -> nenhuma farmácia tem (ou todas recusaram)
//   null                  -> chamado recusado/cancelado
function situacaoDoItem(statusChamado, pedido) {
  if (statusChamado === "pendente") return "aguardando_gerente";
  if (["recusado", "cancelado"].includes(statusChamado)) return null;
  if (!pedido || ["recusada", "cancelada"].includes(pedido.status)) return "sem_fornecedor";
  return {
    solicitada: "aguardando_fornecedor", aprovada: "aguardando_fornecedor",
    enviada: "a_caminho", recebida: "recebido",
  }[pedido.status];
}

// Monta o chamado completo (é isso que o gerente vai receber na notificação)
export function buscarPorId(idChamado) {
  processarChegadas();
  const chamado = db.prepare(/*sql*/ `
    SELECT
        ch.id_chamado    AS idChamado,
        ch.titulo        AS titulo,
        ch.descricao     AS descricao,
        ch.status        AS status,
        ch.prioridade    AS prioridade,
        ch.data_abertura AS dataAbertura,
        fu.id_funcionario AS idFuncionario,
        fu.nome          AS nomeFuncionario,
        fu.matricula     AS matriculaFuncionario,
        fu.cargo         AS cargoFuncionario,
        fu.turno         AS turnoFuncionario,
        f.id_farmacia    AS idFarmacia,
        f.nome           AS nomeFarmacia,
        ch.id_gerente_resposta AS idGerenteResposta,
        g.nome           AS nomeGerenteResposta,
        ch.data_resposta AS dataResposta,
        ch.resposta_gerente AS respostaGerente
    FROM chamado ch
    INNER JOIN funcionario fu ON fu.id_funcionario = ch.id_funcionario
    INNER JOIN farmacia    f  ON f.id_farmacia     = ch.id_farmacia
    LEFT  JOIN gerente     g  ON g.id_gerente      = ch.id_gerente_resposta
    WHERE ch.id_chamado = ?
  `).get(idChamado);
  if (!chamado) return null;

  const pedidos = pedidosDoChamado(chamado.idChamado);
  const gerentes = db.prepare(/*sql*/ `
    SELECT id_gerente AS idGerente, nome AS nomeGerente, email AS emailGerente
    FROM gerente WHERE id_farmacia = ? ORDER BY nome
  `).all(chamado.idFarmacia);

  return {
    idChamado: chamado.idChamado,
    titulo: chamado.titulo,
    descricao: chamado.descricao,
    status: chamado.status,
    prioridade: chamado.prioridade,
    dataAbertura: chamado.dataAbertura,
    funcionario: {
      idFuncionario: chamado.idFuncionario,
      nomeFuncionario: chamado.nomeFuncionario,
      matriculaFuncionario: chamado.matriculaFuncionario,
      cargoFuncionario: chamado.cargoFuncionario,
      turnoFuncionario: chamado.turnoFuncionario,
    },
    farmacia: { idFarmacia: chamado.idFarmacia, nomeFarmacia: chamado.nomeFarmacia },
    remedios: remediosDoChamado(chamado.idChamado, chamado.idFarmacia).map((item) => {
      const pedido = pedidos.filter((p) => p.idRemedio === item.idRemedio).at(-1);
      return {
        ...item,
        situacao: situacaoDoItem(chamado.status, pedido),
        pedidoAtual: pedido ? {
          idRedistribuicao: pedido.idRedistribuicao,
          status: pedido.status,
          idFarmaciaFornecedora: pedido.idFarmaciaOrigem,
          nomeFarmaciaFornecedora: pedido.nomeFarmaciaOrigem,
          dataPrevistaChegada: pedido.dataPrevistaChegada,
          segundosParaChegar: pedido.segundosParaChegar,
          dataRecebimento: pedido.dataRecebimento,
        } : null,
      };
    }),
    // todas as tentativas de pedido às outras farmácias (inclui recusas)
    pedidos,
    // gerentes da farmácia que devem responder a solicitação
    gerentes,
    // null enquanto o gerente não aceitar/recusar
    resposta: chamado.dataResposta && {
      idGerente: chamado.idGerenteResposta,
      nomeGerente: chamado.nomeGerenteResposta,
      dataResposta: chamado.dataResposta,
      respostaGerente: chamado.respostaGerente,
    },
  };
}

// ?status=pendente (opcional). Sem status, traz todos.
function lerStatus(valor) {
  const status = texto(valor).toLowerCase();
  if (status && !STATUS.includes(status)) {
    throw erro(400, `Status inválido. Use: ${STATUS.join(", ")}.`);
  }
  return status || null;
}

// Pendentes primeiro, depois do mais recente para o mais antigo
function listar(filtroSql, valor, status) {
  return db.prepare(/*sql*/ `
    SELECT id_chamado FROM chamado
    WHERE ${filtroSql} = ? AND (? IS NULL OR status = ?)
    ORDER BY status = 'pendente' DESC, data_abertura DESC, id_chamado DESC
  `).all(valor, status, status).map((linha) => buscarPorId(linha.id_chamado));
}

// Chamados da farmácia do gerente (é a "caixa de notificações" dele)
export function listarDoGerente(idGerente, statusQuery) {
  processarChegadas();
  const status = lerStatus(statusQuery);
  const gerente = db.prepare("SELECT id_farmacia FROM gerente WHERE id_gerente = ?").get(idGerente);
  if (!gerente) throw erro(404, "Gerente não encontrado");

  const { total } = db.prepare(
    "SELECT COUNT(*) AS total FROM chamado WHERE id_farmacia = ? AND status = 'pendente'",
  ).get(gerente.id_farmacia);

  return { totalPendentes: total, chamados: listar("id_farmacia", gerente.id_farmacia, status) };
}

// Chamados que o funcionário solicitou (para ele acompanhar a resposta)
export function listarDoFuncionario(idFuncionario, statusQuery) {
  const status = lerStatus(statusQuery);
  const existe = db.prepare("SELECT 1 FROM funcionario WHERE id_funcionario = ?").get(idFuncionario);
  if (!existe) throw erro(404, "Funcionario não encontrado");
  return listar("id_funcionario", idFuncionario, status);
}

// Gerente aceita ou recusa um chamado pendente
export function responder(idChamado, data) {
  const idGerente = Number(data.idGerente);
  if (!Number.isInteger(idGerente) || idGerente <= 0) throw erro(400, "Informe idGerente.");
  if (typeof data.aceitar !== "boolean") throw erro(400, "Informe aceitar: true ou false.");

  const resposta = textoOuNull(data.resposta);
  if (!data.aceitar && !resposta) throw erro(400, "Informe o motivo da recusa em resposta.");

  const chamado = db.prepare("SELECT status, id_farmacia FROM chamado WHERE id_chamado = ?").get(idChamado);
  if (!chamado) throw erro(404, "Chamado não encontrado");

  const gerente = db.prepare("SELECT id_farmacia, nome FROM gerente WHERE id_gerente = ?").get(idGerente);
  if (!gerente) throw erro(404, "Gerente não encontrado");
  if (gerente.id_farmacia !== chamado.id_farmacia) {
    throw erro(403, "Este chamado pertence a outra farmácia.");
  }
  if (chamado.status !== "pendente") {
    throw erro(409, `Este chamado já foi respondido (status: ${chamado.status}).`);
  }

  if (data.aceitar) {
    const nome = data.nomeGerenteConfirmacao;
    if (typeof nome !== "string" || !nome.trim() ||
        nome.trim().normalize("NFC") !== gerente.nome.trim().normalize("NFC")) {
      throw erro(400, "Digite o nome completo do gerente responsável para confirmar o aceite.");
    }
  }

  // Aceitar = "abrir" o chamado para a rede: cada remédio vira um pedido
  // para a farmácia que tem mais sobrando (tudo na mesma transação)
  return emTransacao(() => {
    // "AND status = 'pendente'" evita que dois gerentes respondam ao mesmo tempo
    const { changes } = db.prepare(/*sql*/ `
      UPDATE chamado
      SET status = ?, id_gerente_resposta = ?, data_resposta = CURRENT_TIMESTAMP, resposta_gerente = ?
      WHERE id_chamado = ? AND status = 'pendente'
    `).run(data.aceitar ? "em_andamento" : "recusado", idGerente, resposta, idChamado);
    if (changes === 0) throw erro(409, "Este chamado já foi respondido.");

    const despacho = data.aceitar ? despachar(idChamado) : [];
    return { chamado: buscarPorId(idChamado), despacho };
  });
}

// Confere o gerente e devolve o chamado (ações do gerente da farmácia solicitante)
function chamadoDoGerente(idChamado, idGerenteValor) {
  const idGerente = Number(idGerenteValor);
  if (!Number.isInteger(idGerente) || idGerente <= 0) throw erro(400, "Informe idGerente.");
  const chamado = db.prepare("SELECT status, id_farmacia FROM chamado WHERE id_chamado = ?").get(idChamado);
  if (!chamado) throw erro(404, "Chamado não encontrado");
  const gerente = db.prepare("SELECT id_farmacia FROM gerente WHERE id_gerente = ?").get(idGerente);
  if (!gerente) throw erro(404, "Gerente não encontrado");
  if (gerente.id_farmacia !== chamado.id_farmacia) throw erro(403, "Este chamado pertence a outra farmácia.");
  return chamado;
}

// Antes de aceitar: quais farmácias da rede têm cada remédio do chamado
export function disponibilidade(idChamado, idGerente) {
  const chamado = chamadoDoGerente(idChamado, idGerente);
  const itens = db.prepare(/*sql*/ `
    SELECT cr.id_remedio AS idRemedio, r.nome AS nomeRemedio, r.dosagem AS dosagemRemedio,
           cr.quantidade AS quantidadeSolicitada
    FROM chamado_remedio cr INNER JOIN remedio r ON r.id_remedio = cr.id_remedio
    WHERE cr.id_chamado = ? ORDER BY r.nome
  `).all(idChamado);

  const remedios = itens.map((item) => {
    const farmacias = farmaciasComRemedio(item.idRemedio, chamado.id_farmacia).map((f) => ({
      ...f,
      // pode mandar tudo sem ficar abaixo do próprio estoque mínimo
      podeAtender: !f.vencido && f.disponivel >= (item.quantidadeSolicitada ?? 1),
    }));
    return { ...item, farmacias, temFornecedor: farmacias.some((f) => f.podeAtender) };
  });
  return { idChamado, remedios, todosTemFornecedor: remedios.every((r) => r.temFornecedor) };
}

// Tenta de novo os itens sem fornecedor (ex.: outra farmácia recebeu estoque)
export function redistribuir(idChamado, idGerente) {
  const chamado = chamadoDoGerente(idChamado, idGerente);
  if (chamado.status !== "em_andamento") {
    throw erro(409, `Só dá para redistribuir chamado em andamento (status: ${chamado.status}).`);
  }
  return emTransacao(() => {
    const despacho = despachar(idChamado);
    return { chamado: buscarPorId(idChamado), despacho };
  });
}

// Funcionário solicita um chamado ao gerente (nasce como 'pendente')
export function solicitar(idFuncionario, data) {
  const funcionario = db.prepare(
    "SELECT id_funcionario, id_farmacia FROM funcionario WHERE id_funcionario = ?",
  ).get(idFuncionario);
  if (!funcionario) throw erro(404, "Funcionario não encontrado");

  const itens = lerRemedios(data.remedios);
  const prioridade = lerPrioridade(data.prioridade);

  const existe = db.prepare("SELECT nome FROM remedio WHERE id_remedio = ?");
  const nomes = itens.map((item) => {
    const remedio = existe.get(item.idRemedio);
    if (!remedio) throw erro(404, `Remédio ${item.idRemedio} não encontrado.`);
    return remedio.nome;
  });

  // Sem título, gera um a partir dos remédios: "Reposição: Dipirona, Paracetamol"
  const titulo = texto(data.titulo) || `Reposição: ${nomes.join(", ")}`;

  const idChamado = emTransacao(() => {
    const { lastInsertRowid } = db.prepare(/*sql*/ `
      INSERT INTO chamado (titulo, descricao, status, prioridade, id_funcionario, id_farmacia)
      VALUES (?, ?, 'pendente', ?, ?, ?)
    `).run(titulo, textoOuNull(data.descricao), prioridade,
      funcionario.id_funcionario, funcionario.id_farmacia);

    const inserirItem = db.prepare(
      "INSERT INTO chamado_remedio (id_chamado, id_remedio, quantidade) VALUES (?, ?, ?)",
    );
    for (const item of itens) inserirItem.run(lastInsertRowid, item.idRemedio, item.quantidade);

    return Number(lastInsertRowid);
  });

  return buscarPorId(idChamado);
}
