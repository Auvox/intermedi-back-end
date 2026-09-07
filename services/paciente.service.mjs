import db from "../database/database.mjs";

// cadastrar
export function cadastrar(data) {
  const { nomePaciente, cpfPaciente, telPaciente, dataNasciPaciente } = data;
  const stmt = db.prepare(/*sql*/ `
    INSERT OR IGNORE INTO "tbPaciente" 
        ("nomePaciente", "cpfPaciente", "telPaciente", "dataNasciPaciente")
    VALUES 
        (?, ?, ?, ?)
    `);

  const result = stmt.run(
    nomePaciente,
    cpfPaciente,
    telPaciente,
    dataNasciPaciente,
  );

  return {
    idPaciente: Number(result.lastInsertRowid),
  };
}

//listar
export function listar() {
  const stmt = db.prepare(/*sql*/ `
    SELECT * FROM "tbPaciente"
    `);

  return stmt.all();
}

//busca individual
export function buscarPorId(id) {
  const stmt = db.prepare(/*sql*/ `
    SELECT *
        FROM tbPaciente
    WHERE 
        idPaciente = ?
    `);

  return stmt.get(id);
}

//editar update
export function editar(id, data) {
  const stmt = db.prepare(/*sql*/ `
    UPDATE tbPaciente
    SET
      nomePaciente = ?,
      cpfPaciente = ?,
      telPaciente = ?,
      dataNasciPaciente = ?
    WHERE 
        idPaciente = ?
  `);

  return stmt.run(
    data.nomePaciente,
    data.cpfPaciente,
    data.telPaciente,
    data.dataNasciPaciente,
    id,
  );
}

//deletar
export function deletar(id) {
  const stmt = db.prepare(/*sql*/ `
    DELETE FROM tbPaciente
    WHERE idPaciente = ?
  `);

  return stmt.run(id);
}
