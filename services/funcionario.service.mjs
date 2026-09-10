import db from "../database/database.mjs";

// gera uma matricula de 6 digitos que ainda nao existe no banco
function gerarMatriculaUnica() {
  const stmt = db.prepare(/*sql*/ `
    SELECT 1 FROM "tbFuncionario"
    WHERE matriculaFuncionario = ?
  `);

  for (let i = 0; i < 10; i++) {
    const matricula = String(Math.floor(Math.random() * 1000000)).padStart(
      6,
      "0",
    );

    if (!stmt.get(matricula)) {
      return matricula;
    }
  }

  throw new Error("Nao foi possivel gerar uma matricula unica.");
}

// cadastrar
export function cadastrar(data) {
  const {
    nomeFuncionario,
    cpfFuncionario,
    emailFuncionario,
    telFuncionario,
    cargoFuncionario,
    turnoFuncionario,
    fkIdFarmacia,
  } = data;

  const existente = db
    .prepare(
      /*sql*/ `
    SELECT cpfFuncionario, emailFuncionario
    FROM "tbFuncionario"
    WHERE cpfFuncionario = ? OR emailFuncionario = ?
  `,
    )
    .get(cpfFuncionario, emailFuncionario);

  if (existente) {
    if (existente.cpfFuncionario === cpfFuncionario)
      throw new Error("CPF já cadastrado.");
    if (existente.emailFuncionario === emailFuncionario)
      throw new Error("E-mail já cadastrado.");
  }

  // matricula gerada aqui no back e adicionada aos dados da requisicao
  const matriculaFuncionario = gerarMatriculaUnica();

  const stmt = db.prepare(/*sql*/ `
    INSERT INTO "tbFuncionario" 
        ("nomeFuncionario", "cpfFuncionario", "emailFuncionario", "matriculaFuncionario", "telFuncionario", "cargoFuncionario", "turnoFuncionario", "fkIdFarmacia")
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    nomeFuncionario,
    cpfFuncionario,
    emailFuncionario,
    matriculaFuncionario,
    telFuncionario,
    cargoFuncionario,
    turnoFuncionario,
    fkIdFarmacia ?? null,
  );

  return {
    idFuncionario: Number(result.lastInsertRowid),
    matriculaFuncionario,
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
      turnoFuncionario = ?,
      fkIdFarmacia = ?
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
    data.fkIdFarmacia ?? null,
    id,
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
