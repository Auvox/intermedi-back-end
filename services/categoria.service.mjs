import db from "../database/database.mjs";

// listar categorias (usadas no cadastro de remédio: idsCategoria)
export function listar() {
  return db.prepare(/*sql*/ `
    SELECT
        c.id_categoria AS idCategoria,
        c.nome         AS nomeCategoria,
        c.descricao    AS descCategoria,
        COUNT(rc.id_remedio) AS totalRemedios
    FROM categoria c
    LEFT JOIN remedio_categoria rc ON rc.id_categoria = c.id_categoria
    GROUP BY c.id_categoria
    ORDER BY c.nome ASC
  `).all();
}
