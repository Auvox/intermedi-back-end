import db from "../database/database.mjs";

// cadastrar
export function cadastrar(data) {
  const { nomeRemedio, descRemedio, dosagemRemedio, fabricanteRemedio } = data;
  const stmt = db.prepare(/*sql*/ `
    INSERT OR IGNORE INTO "tbCadastroRemedio" 
        ("nomeRemedio", "descRemedio", "dosagemRemedio", "fabricanteRemedio")
    VALUES 
        (?, ?, ?, ?)
    `);

  const result = stmt.run(
    nomeRemedio,
    descRemedio,
    dosagemRemedio,
    fabricanteRemedio,
  );

  return {
    idRemedio: Number(result.lastInsertRowid),
  };
}

//listar
export function listar() {
  const stmt = db.prepare(/*sql*/ `
    SELECT * FROM "tbCadastroRemedio"
    `);

  return stmt.all();
}

//busca individual
export function buscarPorId(id) {
  const stmt = db.prepare(/*sql*/ `
    SELECT *
        FROM tbCadastroRemedio
    WHERE 
        idRemedio = ?
    `);

    return stmt.get(id)
}

//editar update
export function editar(id, data) {

  const stmt = db.prepare(`
    UPDATE tbCadastroRemedio
    SET
      nomeRemedio = ?,
      descRemedio = ?,
      dosagemRemedio = ?,
      fabricanteRemedio = ?
    WHERE idRemedio = ?
  `);

  return stmt.run(
    data.nomeRemedio,
    data.descRemedio,
    data.dosagemRemedio,
    data.fabricanteRemedio,
    id
  );
}

//deletar
export function deletar(id) {

  const stmt = db.prepare(`
    DELETE FROM tbCadastroRemedio
    WHERE idRemedio = ?
  `);

  return stmt.run(id);
}