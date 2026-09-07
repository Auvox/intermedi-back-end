import db from "../database/database.mjs";

// cadastrar
export function cadastrar(data) {
  const { nomeFarmacia, cnesFarmacia, telFarmacia } = data;
  const stmt = db.prepare(/*sql*/ `
    INSERT OR IGNORE INTO "tbFarmacia" 
      ("nomeFarmacia", "cnesFarmacia", "telFarmacia")
    VALUES 
        (?, ?, ?)
    `);

  const result = stmt.run(nomeFarmacia, cnesFarmacia, telFarmacia);

  return {
    idFarmacia: Number(result.lastInsertRowid),
  };
}

//listar
export function listar() {
  const stmt = db.prepare(/*sql*/ `
    SELECT * FROM "tbFarmacia"
    `);
  return stmt.all();
}

//busca individual
export function buscarPorId(id) {
  const stmt = db.prepare(/*sql*/ `
    SELECT *
        FROM tbFarmacia
    WHERE 
        idFarmacia = ?
    `);

  return stmt.get(id);
}

//editar update
export function editar(id, data) {
  const stmt = db.prepare(/*sql*/ `
    UPDATE tbFarmacia
    SET
      nomeFarmacia = ?,
      cnesFarmacia = ?,
      telFarmacia = ? 
    WHERE 
      idFarmacia = ?
  `);

  return stmt.run(data.nomeFarmacia, data.cnesFarmacia, data.telFarmacia, id);
}

//deletar
export function deletar(id) {
  const stmt = db.prepare(/*sql*/ `
    DELETE FROM tbFarmacia
    WHERE idFarmacia = ?
  `);

  return stmt.run(id);
} //é apenas um teste
