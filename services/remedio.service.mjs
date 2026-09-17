import db, { emTransacao } from "../database/database.mjs";
import { erro } from "../utils/http.mjs";
import { mesclar, texto, textoOuNull } from "../utils/dados.mjs";

// categorias: nomes separados por vírgula ("Dor de cabeça, Febre")
// idsCategoria: lista de ids ([1, 2])
const SELECT_REMEDIO = /*sql*/ `
  SELECT
      r.id_remedio  AS idRemedio,
      r.nome        AS nomeRemedio,
      r.descricao   AS descRemedio,
      r.dosagem     AS dosagemRemedio,
      r.fabricante  AS fabricanteRemedio,
      r.created_at  AS createdAtRemedio,
      group_concat(c.nome, ', ')       AS categorias,
      group_concat(c.id_categoria)     AS idsCategoria
  FROM remedio r
  LEFT JOIN remedio_categoria rc ON rc.id_remedio  = r.id_remedio
  LEFT JOIN categoria         c  ON c.id_categoria = rc.id_categoria
`;

const formatar = (linha) =>
  linha && {
    ...linha,
    categorias: linha.categorias ?? "",
    idsCategoria: linha.idsCategoria ? linha.idsCategoria.split(",").map(Number) : [],
  };

function validar(dados) {
  if (!texto(dados.nomeRemedio)) throw erro(400, "Informe nomeRemedio.");
}

// idsCategoria é opcional; quando vier, substitui as categorias do remédio
function salvarCategorias(idRemedio, idsCategoria) {
  if (idsCategoria === undefined) return;
  if (!Array.isArray(idsCategoria) || !idsCategoria.every((id) => Number.isInteger(id) && id > 0)) {
    throw erro(400, "idsCategoria deve ser uma lista de ids (ex.: [1, 2]).");
  }

  db.prepare("DELETE FROM remedio_categoria WHERE id_remedio = ?").run(idRemedio);
  const inserir = db.prepare(
    "INSERT OR IGNORE INTO remedio_categoria (id_remedio, id_categoria) VALUES (?, ?)",
  );
  for (const idCategoria of idsCategoria) inserir.run(idRemedio, idCategoria);
}

// cadastrar
export function cadastrar(data) {
  validar(data);

  return emTransacao(() => {
    const result = db.prepare(/*sql*/ `
      INSERT INTO remedio (nome, descricao, dosagem, fabricante)
      VALUES (?, ?, ?, ?)
    `).run(
      texto(data.nomeRemedio),
      textoOuNull(data.descRemedio),
      textoOuNull(data.dosagemRemedio),
      textoOuNull(data.fabricanteRemedio),
    );

    const idRemedio = Number(result.lastInsertRowid);
    salvarCategorias(idRemedio, data.idsCategoria);

    return { idRemedio };
  });
}

// listar (opcional: filtrar por nome da categoria, ex.: "Dor de cabeça")
export function listar(categoria) {
  if (categoria) {
    return db.prepare(/*sql*/ `
      ${SELECT_REMEDIO}
      WHERE r.id_remedio IN (
        SELECT rc2.id_remedio
        FROM remedio_categoria rc2
        INNER JOIN categoria c2 ON c2.id_categoria = rc2.id_categoria
        WHERE c2.nome = ?
      )
      GROUP BY r.id_remedio
      ORDER BY r.nome
    `).all(categoria).map(formatar);
  }

  return db.prepare(`${SELECT_REMEDIO} GROUP BY r.id_remedio ORDER BY r.nome`).all().map(formatar);
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
  if (!atual) return { changes: 0 };

  const dados = mesclar(atual, data);
  validar(dados);

  return emTransacao(() => {
    const result = db.prepare(/*sql*/ `
      UPDATE remedio
      SET nome = ?, descricao = ?, dosagem = ?, fabricante = ?
      WHERE id_remedio = ?
    `).run(
      texto(dados.nomeRemedio),
      textoOuNull(dados.descRemedio),
      textoOuNull(dados.dosagemRemedio),
      textoOuNull(dados.fabricanteRemedio),
      id,
    );

    salvarCategorias(id, data.idsCategoria);
    return { changes: Number(result.changes) };
  });
}

// deletar (bloqueado pelo banco se o remédio estiver em estoque/serviço/chamado)
export function deletar(id) {
  const result = db.prepare("DELETE FROM remedio WHERE id_remedio = ?").run(id);
  return { changes: Number(result.changes) };
}
