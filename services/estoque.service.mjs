import db from "../database/database.mjs";
import { erro } from "../utils/http.mjs";
import { texto, textoOuNull } from "../utils/dados.mjs";
import { processarChegadas } from "./redistribuicao.service.mjs";

// Estoque de cada farmácia. O gerente só pode adicionar remédios que
// já existem no catálogo do admin (tabela remedio).
const SELECT_ESTOQUE = /*sql*/ `
  SELECT
      es.id_estoque          AS idEstoque,
      es.id_farmacia         AS idFarmacia,
      f.nome                 AS nomeFarmacia,
      r.id_remedio           AS idRemedio,
      r.nome                 AS nomeRemedio,
      r.principio_ativo      AS principioAtivoRemedio,
      r.dosagem              AS dosagemRemedio,
      r.fabricante           AS fabricanteRemedio,
      r.forma_farmaceutica   AS formaFarmaceuticaRemedio,
      r.apresentacao         AS apresentacaoRemedio,
      r.tarja                AS tarjaRemedio,
      r.foto                 AS fotoRemedio,
      es.quantidade          AS quantidade,
      es.estoque_minimo      AS estoqueMinimo,
      es.lote                AS lote,
      es.validade            AS validade,
      (es.validade IS NOT NULL AND es.validade < date('now', 'localtime')) AS vencido,
      es.id_gerente_cadastro AS idGerenteCadastro,
      es.created_at          AS createdAtEstoque,
      es.updated_at          AS updatedAtEstoque
  FROM estoque es
  INNER JOIN remedio  r ON r.id_remedio  = es.id_remedio
  INNER JOIN farmacia f ON f.id_farmacia = es.id_farmacia
`;

// situacao: "zerado" | "critico" | "ok"  (vencido vem em um campo separado)
const formatar = (linha) => linha && {
  ...linha,
  vencido: Boolean(linha.vencido),
  critico: linha.quantidade <= linha.estoqueMinimo,
  situacao: linha.quantidade === 0 ? "zerado"
    : linha.quantidade <= linha.estoqueMinimo ? "critico" : "ok",
  exigeReceita: linha.tarjaRemedio !== "sem_tarja",
  retemReceita: ["vermelha_retencao", "preta"].includes(linha.tarjaRemedio),
};

const SITUACOES = ["ok", "critico", "zerado", "vencido"];

// "10" ou 10 -> 10 (inteiro >= minimo)
function inteiro(valor, campo, minimo = 0) {
  const numero = Number(valor);
  if (valor === null || valor === "" || !Number.isSafeInteger(numero) || numero < minimo) {
    throw erro(400, `${campo} deve ser um número inteiro ${minimo > 0 ? "maior que zero" : "maior ou igual a zero"}.`);
  }
  return numero;
}

// "2027-06-30" (ou vazio/null para limpar)
function lerValidade(valor) {
  const data = texto(valor);
  if (!data) return null;
  const dia = new Date(`${data}T00:00:00Z`);
  const valida = /^\d{4}-\d{2}-\d{2}$/.test(data) &&
    !Number.isNaN(dia.getTime()) && dia.toISOString().startsWith(data);
  if (!valida) throw erro(400, "validade deve estar no formato AAAA-MM-DD.");
  return data;
}

function farmaciaDoGerente(idGerente) {
  const gerente = db.prepare("SELECT id_farmacia FROM gerente WHERE id_gerente = ?").get(idGerente);
  if (!gerente) throw erro(404, "Gerente não encontrado");
  return gerente.id_farmacia;
}

export function buscarItem(idFarmacia, idRemedio) {
  return formatar(
    db.prepare(`${SELECT_ESTOQUE} WHERE es.id_farmacia = ? AND es.id_remedio = ?`).get(idFarmacia, idRemedio),
  );
}

// listar o estoque de uma farmácia (funcionário, gerente e admin usam)
//   busca:    parte do nome ou princípio ativo
//   situacao: ok | critico | zerado | vencido
export function listarDaFarmacia(idFarmacia, { busca, situacao } = {}) {
  processarChegadas(); // remédios de redistribuição que já chegaram entram antes de listar
  const farmacia = db.prepare("SELECT id_farmacia AS idFarmacia, nome AS nomeFarmacia FROM farmacia WHERE id_farmacia = ?")
    .get(idFarmacia);
  if (!farmacia) throw erro(404, "Farmácia não encontrada");

  const filtro = texto(situacao).toLowerCase();
  if (filtro && !SITUACOES.includes(filtro)) {
    throw erro(400, `situacao inválida. Use: ${SITUACOES.join(", ")}.`);
  }

  const termo = texto(busca) ? `%${texto(busca).toLowerCase()}%` : null;
  const todos = db.prepare(/*sql*/ `
    ${SELECT_ESTOQUE}
    WHERE es.id_farmacia = ?
      AND (? IS NULL OR LOWER(r.nome) LIKE ? OR LOWER(r.principio_ativo) LIKE ?)
    ORDER BY r.nome ASC
  `).all(idFarmacia, termo, termo, termo).map(formatar);

  const estoque = !filtro ? todos
    : filtro === "vencido" ? todos.filter((item) => item.vencido)
    : filtro === "critico" ? todos.filter((item) => item.critico)
    : todos.filter((item) => item.situacao === filtro);

  return {
    farmacia,
    resumo: {
      totalItens: todos.length,
      criticos: todos.filter((item) => item.critico).length,
      zerados: todos.filter((item) => item.situacao === "zerado").length,
      vencidos: todos.filter((item) => item.vencido).length,
    },
    estoque,
  };
}

export function listarDoGerente(idGerente, filtros) {
  return listarDaFarmacia(farmaciaDoGerente(idGerente), filtros);
}

// cadastrar: gerente adiciona um remédio do catálogo na farmácia dele
export function cadastrar(idGerente, data) {
  const idFarmacia = farmaciaDoGerente(idGerente);
  const idRemedio = inteiro(data.idRemedio, "idRemedio", 1);

  const remedio = db.prepare("SELECT nome FROM remedio WHERE id_remedio = ?").get(idRemedio);
  if (!remedio) throw erro(404, "Remédio não encontrado no catálogo. Peça ao admin para cadastrá-lo.");
  if (data.quantidade === undefined) throw erro(400, "Informe quantidade.");

  if (buscarItem(idFarmacia, idRemedio)) {
    throw erro(409, `${remedio.nome} já está no estoque desta farmácia. Use PUT para ajustar a quantidade.`);
  }

  db.prepare(/*sql*/ `
    INSERT INTO estoque (id_remedio, id_farmacia, quantidade, estoque_minimo, lote, validade, id_gerente_cadastro)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    idRemedio,
    idFarmacia,
    inteiro(data.quantidade, "quantidade"),
    data.estoqueMinimo === undefined ? 20 : inteiro(data.estoqueMinimo, "estoqueMinimo"),
    textoOuNull(data.lote),
    lerValidade(data.validade),
    idGerente,
  );

  return buscarItem(idFarmacia, idRemedio);
}

// editar: campos não enviados continuam iguais
//   quantidade -> define o valor (ex.: depois de um inventário)
//   entrada    -> soma ao valor atual (ex.: chegou mercadoria)
export function editar(idGerente, idRemedio, data) {
  const idFarmacia = farmaciaDoGerente(idGerente);
  const atual = buscarItem(idFarmacia, idRemedio);
  if (!atual) return null;

  if (data.quantidade !== undefined && data.entrada !== undefined) {
    throw erro(400, "Envie quantidade OU entrada, não os dois.");
  }
  const campos = ["quantidade", "entrada", "estoqueMinimo", "lote", "validade"];
  if (!campos.some((campo) => data[campo] !== undefined)) {
    throw erro(400, `Nada para atualizar. Envie: ${campos.join(", ")}.`);
  }

  const quantidade = data.entrada !== undefined
    ? atual.quantidade + inteiro(data.entrada, "entrada", 1)
    : data.quantidade !== undefined ? inteiro(data.quantidade, "quantidade") : atual.quantidade;

  db.prepare(/*sql*/ `
    UPDATE estoque
    SET quantidade = ?, estoque_minimo = ?, lote = ?, validade = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id_estoque = ?
  `).run(
    quantidade,
    data.estoqueMinimo !== undefined ? inteiro(data.estoqueMinimo, "estoqueMinimo") : atual.estoqueMinimo,
    data.lote !== undefined ? textoOuNull(data.lote) : atual.lote,
    data.validade !== undefined ? lerValidade(data.validade) : atual.validade,
    atual.idEstoque,
  );

  return buscarItem(idFarmacia, idRemedio);
}

// deletar: tira o remédio do estoque da farmácia (o catálogo não muda)
export function deletar(idGerente, idRemedio) {
  const idFarmacia = farmaciaDoGerente(idGerente);
  const atual = buscarItem(idFarmacia, idRemedio);
  if (!atual) return null;

  db.prepare("DELETE FROM estoque WHERE id_estoque = ?").run(atual.idEstoque);
  return atual;
}

// Baixa do estoque ao registrar um serviço.
// Deve ser chamada DENTRO da transação do serviço: se um item falhar,
// nada é gravado (nem o serviço, nem as outras baixas).
export function baixar(idFarmacia, itens) {
  return itens.map(({ idRemedio, quantidade }) => {
    const item = buscarItem(idFarmacia, idRemedio);
    if (!item) {
      const nome = db.prepare("SELECT nome FROM remedio WHERE id_remedio = ?").get(idRemedio)?.nome;
      throw erro(409, `${nome ?? `Remédio ${idRemedio}`} não está no estoque desta farmácia.`);
    }
    if (item.vencido) {
      throw erro(409, `O lote de ${item.nomeRemedio} venceu em ${item.validade}. Atualize o estoque antes de entregar.`);
    }
    if (item.quantidade < quantidade) {
      throw erro(409, `Estoque insuficiente de ${item.nomeRemedio}: disponível ${item.quantidade}, pedido ${quantidade}.`);
    }

    // "quantidade >= ?" protege contra dois serviços baixando ao mesmo tempo
    const { changes } = db.prepare(/*sql*/ `
      UPDATE estoque SET quantidade = quantidade - ?, updated_at = CURRENT_TIMESTAMP
      WHERE id_estoque = ? AND quantidade >= ?
    `).run(quantidade, item.idEstoque, quantidade);
    if (changes === 0) throw erro(409, `Estoque insuficiente de ${item.nomeRemedio}.`);

    const estoqueAtual = item.quantidade - quantidade;
    return {
      idRemedio,
      nomeRemedio: item.nomeRemedio,
      quantidadeBaixada: quantidade,
      estoqueAnterior: item.quantidade,
      estoqueAtual,
      estoqueMinimo: item.estoqueMinimo,
      critico: estoqueAtual <= item.estoqueMinimo,
    };
  });
}
