import db from "../database/database.mjs";

// Cadastrar
export function cadastrar(data) {
  const {
    nomePaciente,
    cpfPaciente,
    telPaciente,
    emailPaciente,
    senhaPaciente,
    medicamentoFrequentePaciente,
    cepPaciente,
    ruaPaciente,
    numeroPaciente,
    bairroPaciente,
    cidadePaciente,
    estadoPaciente,
    complementoPaciente,
  } = data;

  const stmt = db.prepare(/* sql */ `
    INSERT OR IGNORE INTO tbPaciente (
      nomePaciente,
      cpfPaciente,
      telPaciente,
      emailPaciente,
      senhaPaciente,
      medicamentoFrequentePaciente,
      cepPaciente,
      ruaPaciente,
      numeroPaciente,
      bairroPaciente,
      cidadePaciente,
      estadoPaciente,
      complementoPaciente
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    nomePaciente,
    cpfPaciente,
    telPaciente,
    emailPaciente,
    senhaPaciente,
    medicamentoFrequentePaciente,
    cepPaciente,
    ruaPaciente,
    numeroPaciente,
    bairroPaciente,
    cidadePaciente,
    estadoPaciente,
    complementoPaciente,
  );

  return {
    idPaciente: Number(result.lastInsertRowid),
  };
}

// Listar
export function listar() {
  const stmt = db.prepare(/* sql */ `
    SELECT *
    FROM tbPaciente
  `);

  return stmt.all();
}

// Buscar individual
export function buscarPorId(id) {
  const stmt = db.prepare(/* sql */ `
    SELECT *
    FROM tbPaciente
    WHERE idPaciente = ?
  `);

  return stmt.get(id);
}

// Editar
export function editar(id, data) {
  const stmt = db.prepare(/* sql */ `
    UPDATE tbPaciente
    SET
      nomePaciente = ?,
      cpfPaciente = ?,
      telPaciente = ?,
      emailPaciente = ?,
      senhaPaciente = ?,
      medicamentoFrequentePaciente = ?,
      cepPaciente = ?,
      ruaPaciente = ?,
      numeroPaciente = ?,
      bairroPaciente = ?,
      cidadePaciente = ?,
      estadoPaciente = ?,
      complementoPaciente = ?
    WHERE idPaciente = ?
  `);

  return stmt.run(
    data.nomePaciente,
    data.cpfPaciente,
    data.telPaciente,
    data.emailPaciente,
    data.senhaPaciente,
    data.medicamentoFrequentePaciente,
    data.cepPaciente,
    data.ruaPaciente,
    data.numeroPaciente,
    data.bairroPaciente,
    data.cidadePaciente,
    data.estadoPaciente,
    data.complementoPaciente,
    id,
  );
}

// Deletar
export function deletar(id) {
  const stmt = db.prepare(/* sql */ `
    DELETE FROM tbPaciente
    WHERE idPaciente = ?
  `);

  return stmt.run(id);
}
