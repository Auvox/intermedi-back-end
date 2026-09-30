import db, { emTransacao } from "../database/database.mjs";
import { erro } from "../utils/http.mjs";
import { mesclar, texto, textoOuNull } from "../utils/dados.mjs";

// Catálogo geral de remédios (cadastrado pelo admin).
// categorias: nomes separados por vírgula ("Dor de cabeça, Febre")
// idsCategoria: lista de ids ([1, 2])
const SELECT_REMEDIO = /*sql*/ `
  SELECT
      r.id_remedio          AS idRemedio,
      r.nome                AS nomeRemedio,
      r.principio_ativo     AS principioAtivoRemedio,
      r.descricao           AS descRemedio,
      r.dosagem             AS dosagemRemedio,
      r.fabricante          AS fabricanteRemedio,
      r.registro_anvisa     AS registroAnvisaRemedio,
      r.tipo                AS tipoRemedio,
      r.tarja               AS tarjaRemedio,
      r.forma_farmaceutica  AS formaFarmaceuticaRemedio,
      r.via_administracao   AS viaAdministracaoRemedio,
      r.apresentacao        AS apresentacaoRemedio,
      r.indicacoes          AS indicacoesRemedio,
      r.contraindicacoes    AS contraindicacoesRemedio,
      r.armazenamento       AS armazenamentoRemedio,
      r.foto                AS fotoRemedio,
      r.created_at          AS createdAtRemedio,
      r.updated_at          AS updatedAtRemedio,
      group_concat(c.nome, ', ')       AS categorias,
      group_concat(c.id_categoria)     AS idsCategoria
  FROM remedio r
  LEFT JOIN remedio_categoria rc ON rc.id_remedio  = r.id_remedio
  LEFT JOIN categoria         c  ON c.id_categoria = rc.id_categoria
`;

export const TIPOS = ["referencia", "generico", "similar"];
export const TARJAS = ["sem_tarja", "vermelha", "vermelha_retencao", "preta"];

const formatar = (linha) =>
  linha && {
    ...linha,
    // derivados da tarja, para o front mostrar os avisos legais
    exigeReceita: linha.tarjaRemedio !== "sem_tarja",
    retemReceita: ["vermelha_retencao", "preta"].includes(linha.tarjaRemedio),
    categorias: linha.categorias ?? "",
    idsCategoria: linha.idsCategoria ? linha.idsCategoria.split(",").map(Number) : [],
  };

// Campos obrigatórios para a apresentação legal do remédio
const OBRIGATORIOS = {
  nomeRemedio: "nome",
  principioAtivoRemedio: "princípio ativo",
  dosagemRemedio: "dosagem",
  fabricanteRemedio: "fabricante",
  registroAnvisaRemedio: "registro ANVISA",
  tipoRemedio: "tipo",
  formaFarmaceuticaRemedio: "forma farmacêutica",
  apresentacaoRemedio: "apresentação",
};

// "1000100010011" ou "1.0001.0001.001-1" -> "1.0001.0001.001-1"
function normalizarRegistro(valor) {
  const d = texto(valor).replace(/\D/g, "");
  if (d.length !== 13) throw erro(400, "registroAnvisaRemedio deve ter 13 dígitos (ex.: 1.0001.0001.001-1).");
  return `${d[0]}.${d.slice(1, 5)}.${d.slice(5, 9)}.${d.slice(9, 12)}-${d[12]}`;
}

function opcao(valor, lista, campo) {
  const escolhido = texto(valor).toLowerCase();
  if (!lista.includes(escolhido)) throw erro(400, `${campo} inválido. Use: ${lista.join(", ")}.`);
  return escolhido;
}

// Valida e devolve os valores na ordem das colunas
function validar(dados, idIgnorar = -1) {
  const faltando = Object.entries(OBRIGATORIOS)
    .filter(([campo]) => !texto(dados[campo]))
    .map(([, rotulo]) => rotulo);
  if (faltando.length) throw erro(400, `Campos obrigatórios: ${faltando.join(", ")}.`);

  const registro = normalizarRegistro(dados.registroAnvisaRemedio);
  const duplicado = db.prepare(
    "SELECT 1 FROM remedio WHERE registro_anvisa = ? AND id_remedio <> ?",
  ).get(registro, idIgnorar);
  if (duplicado) throw erro(409, "Registro ANVISA já cadastrado.");

  return [
    texto(dados.nomeRemedio),
    texto(dados.principioAtivoRemedio),
    textoOuNull(dados.descRemedio),
    texto(dados.dosagemRemedio),
    texto(dados.fabricanteRemedio),
    registro,
    opcao(dados.tipoRemedio, TIPOS, "tipoRemedio"),
    opcao(dados.tarjaRemedio || "sem_tarja", TARJAS, "tarjaRemedio"),
    texto(dados.formaFarmaceuticaRemedio),
    textoOuNull(dados.viaAdministracaoRemedio),
    texto(dados.apresentacaoRemedio),
    textoOuNull(dados.indicacoesRemedio),
    textoOuNull(dados.contraindicacoesRemedio),
    textoOuNull(dados.armazenamentoRemedio),
  ];
}

// idsCategoria é opcional; quando vier, substitui as categorias do remédio
function salvarCategorias(idRemedio, idsCategoria) {
  if (idsCategoria === undefined) return;
  if (!Array.isArray(idsCategoria) || !idsCategoria.every((id) => Number.isInteger(id) && id > 0)) {
    throw erro(400, "idsCategoria deve ser uma lista de ids (ex.: [1, 2]).");
  }
  const existe = db.prepare("SELECT 1 FROM categoria WHERE id_categoria = ?");
  const inexistente = idsCategoria.find((id) => !existe.get(id));
  if (inexistente) throw erro(400, `Categoria ${inexistente} não existe.`);

  db.prepare("DELETE FROM remedio_categoria WHERE id_remedio = ?").run(idRemedio);
  const inserir = db.prepare(
    "INSERT OR IGNORE INTO remedio_categoria (id_remedio, id_categoria) VALUES (?, ?)",
  );
  for (const idCategoria of idsCategoria) inserir.run(idRemedio, idCategoria);
}

// cadastrar
export function cadastrar(data) {
  const valores = validar(data);

  return emTransacao(() => {
    const result = db.prepare(/*sql*/ `
      INSERT INTO remedio (nome, principio_ativo, descricao, dosagem, fabricante, registro_anvisa,
                           tipo, tarja, forma_farmaceutica, via_administracao, apresentacao,
                           indicacoes, contraindicacoes, armazenamento)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(...valores);

    const idRemedio = Number(result.lastInsertRowid);
    salvarCategorias(idRemedio, data.idsCategoria);
    return buscarPorId(idRemedio);
  });
}

// listar (filtros opcionais)
//   busca:     parte do nome, princípio ativo ou dosagem ("dipi")
//   categoria: parte do nome da categoria ("dor")
export function listar({ busca, categoria } = {}) {
  const termoBusca = texto(busca) ? `%${texto(busca).toLowerCase()}%` : null;
  const termoCategoria = texto(categoria) ? `%${texto(categoria).toLowerCase()}%` : null;

  return db.prepare(/*sql*/ `
    ${SELECT_REMEDIO}
    WHERE (? IS NULL OR LOWER(r.nome) LIKE ? OR LOWER(r.principio_ativo) LIKE ? OR LOWER(r.dosagem) LIKE ?)
      AND (? IS NULL OR r.id_remedio IN (
            SELECT rc2.id_remedio
            FROM remedio_categoria rc2
            INNER JOIN categoria c2 ON c2.id_categoria = rc2.id_categoria
            WHERE LOWER(c2.nome) LIKE ?))
    GROUP BY r.id_remedio
    ORDER BY r.nome ASC
  `).all(termoBusca, termoBusca, termoBusca, termoBusca, termoCategoria, termoCategoria)
    .map(formatar);
}

// busca individual
export function buscarPorId(id) {
  return formatar(
    db.prepare(`${SELECT_REMEDIO} WHERE r.id_remedio = ? GROUP BY r.id_remedio`).get(id),
  );
}

// editar (campos não enviados continuam iguais)
export function editar(id, data) {
  const atual = buscarPorId(id);
  if (!atual) return null;

  const valores = validar(mesclar(atual, data), id);

  return emTransacao(() => {
    db.prepare(/*sql*/ `
      UPDATE remedio
      SET nome = ?, principio_ativo = ?, descricao = ?, dosagem = ?, fabricante = ?,
          registro_anvisa = ?, tipo = ?, tarja = ?, forma_farmaceutica = ?,
          via_administracao = ?, apresentacao = ?, indicacoes = ?, contraindicacoes = ?,
          armazenamento = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id_remedio = ?
    `).run(...valores, id);

    salvarCategorias(id, data.idsCategoria);
    return buscarPorId(id);
  });
}

// deletar (não deixa apagar remédio que já tem histórico no sistema)
export function deletar(id) {
  const atual = buscarPorId(id);
  if (!atual) return null;

  const uso = db.prepare(/*sql*/ `
    SELECT
      (SELECT COUNT(*) FROM estoque         WHERE id_remedio = ?) AS estoque,
      (SELECT COUNT(*) FROM chamado_remedio WHERE id_remedio = ?) AS chamados,
      (SELECT COUNT(*) FROM servico_remedio WHERE id_remedio = ?) AS servicos,
      (SELECT COUNT(*) FROM redistribuicao  WHERE id_remedio = ?) AS redistribuicoes
  `).get(id, id, id, id);
  const vinculos = Object.entries(uso).filter(([, total]) => total > 0).map(([nome, total]) => `${nome} (${total})`);
  if (vinculos.length) {
    throw erro(409, `Não é possível apagar: o remédio está em uso em ${vinculos.join(", ")}.`);
  }

  db.prepare("DELETE FROM remedio WHERE id_remedio = ?").run(id);
  return atual;
}

// foto: grava a URL nova e devolve a antiga (para apagar o arquivo)
export function atualizarFoto(id, url) {
  const atual = db.prepare("SELECT foto FROM remedio WHERE id_remedio = ?").get(id);
  if (!atual) return undefined;
  db.prepare("UPDATE remedio SET foto = ?, updated_at = CURRENT_TIMESTAMP WHERE id_remedio = ?").run(url, id);
  return atual.foto;
}
