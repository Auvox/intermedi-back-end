import db from "../database/database.mjs";

// cadastrar
export function cadastrar(data) {
  const { nomeGerente, emailGerente, senhaGerente } = data;
  const stmt = db.prepare(/*sql*/ `
    INSERT OR IGNORE INTO "tbGerente" 
        ("nomeGerente", "emailGerente", "senhaGerente")
    VALUES 
        (?, ?, ?)
    `);

  const result = stmt.run(nomeGerente, emailGerente, senhaGerente);

  return {
    idGerente: Number(result.lastInsertRowid),
  };
}

//listar
export function listar() {
  const stmt = db.prepare(/*sql*/ `
    SELECT * FROM "tbGerente"
    `);

  return stmt.all();
}

//busca individual
export function buscarPorId(id) {
  const stmt = db.prepare(/*sql*/ `
    SELECT *
        FROM tbGerente
    WHERE 
        idGerente = ?
    `);

  return stmt.get(id);
}

//editar update
export function editar(id, data) {
  const stmt = db.prepare(/*sql*/ `
    UPDATE tbGerente
    SET
      nomeGerente = ?,
      emailGerente = ?,
      senhaGerente = ?
    WHERE 
        idGerente = ?
  `);

  return stmt.run(data.nomeGerente, data.emailGerente, data.senhaGerente, id);
}

//deletar
export function deletar(id) {
  const stmt = db.prepare(`
    DELETE FROM tbGerente
    WHERE idGerente = ?
  `);

  return stmt.run(id);
}
