import db from "../database/database.mjs";

// cadastrar
export function cadastrar(data) {
  const {
    nomeFuncionario,
    cpfFuncionario,
    emailFuncionario,
    matriculaFuncionario,
    telFuncionario,
    cargoFuncionario,
    turnoFuncionario
  } = data;
  const stmt = db.prepare(/*sql*/ `
    INSERT OR IGNORE INTO "tbFuncionario" 
        ("nomeFuncionario", "cpfFuncionario", "emailFuncionario", "matriculaFuncionario", "telFuncionario", "cargoFuncionario", "turnoFuncionario")
    VALUES 
        (?, ?, ?, ?, ?, ?, ?)
    `);

  const result = stmt.run(
    nomeFuncionario,
    cpfFuncionario,
    emailFuncionario,
    matriculaFuncionario,
    telFuncionario,
    cargoFuncionario,
    turnoFuncionario
  );

  return {
    idFuncionario: Number(result.lastInsertRowid),
  };
}

//listar
export function listar() {
  const stmt = db.prepare(/*sql*/ `
    SELECT * FROM "tbFuncionario"
    `);

  return stmt.all();
}

//busca individual
export function buscarPorId(id) {
  const stmt = db.prepare(/*sql*/ `
    SELECT *
        FROM tbFuncionario
    WHERE 
        idFuncionario = ?
    `);

  return stmt.get(id);
}

//editar update
export function editar(id, data) {
  const stmt = db.prepare(/*sql*/ `
    UPDATE tbFuncionario
    SET
      nomeFuncionario = ?,
      cpfFuncionario = ?,
      emailFuncionario = ?,
      matriculaFuncionario = ?,
      telFuncionario= ?, 
      cargoFuncionario = ?, 
      turnoFuncionario = ?
    WHERE idFuncionario = ?
  `);

  return stmt.run(
    data.nomeFuncionario,
    data.cpfFuncionario,
    data.emailFuncionario,
    data.matriculaFuncionario,
    data.telFuncionario,
    data.cargoFuncionario,
    data.turnoFuncionario,
    id
  );
}

//deletar
export function deletar(id) {
  const stmt = db.prepare(/*sql*/ `
    DELETE FROM tbFuncionario
    WHERE idFuncionario = ?
  `);

  return stmt.run(id);
}
