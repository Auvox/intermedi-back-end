import db from "../database/database.mjs";

// cadastrar
export function cadastrar(data) {
  const {
    nomeFarmacia,
    emailFarmacia,
    telFarmacia,
    cnesFarmacia,
    senhaFarmacia,
    idGerente,
    cepFarmacia,
    enderecoFarmacia,
    numeroFarmacia,
    complementoFarmacia,
    bairroFarmacia,
    cidadeFarmacia,
  } = data;

  const stmt = db.prepare(/*sql*/ `
    INSERT OR IGNORE INTO "tbFarmacia" (
      "nomeFarmacia",
      "emailFarmacia",
      "telFarmacia",
      "cnesFarmacia",
      "senhaFarmacia",
      "idGerente",
      "cepFarmacia",
      "enderecoFarmacia",
      "numeroFarmacia",
      "complementoFarmacia",
      "bairroFarmacia",
      "cidadeFarmacia"
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    nomeFarmacia,
    emailFarmacia,
    telFarmacia,
    cnesFarmacia,
    senhaFarmacia,
    idGerente,
    cepFarmacia,
    enderecoFarmacia,
    numeroFarmacia,
    complementoFarmacia ?? null,
    bairroFarmacia,
    cidadeFarmacia,
  );

  return {
    idFarmacia: Number(result.lastInsertRowid),
  };
}

// listar
export function listar() {
  const stmt = db.prepare(/*sql*/ `
    SELECT * FROM "tbFarmacia"
  `);

  return stmt.all();
}

// busca individual
export function buscarPorId(id) {
  const stmt = db.prepare(/*sql*/ `
    SELECT *
    FROM "tbFarmacia"
    WHERE "idFarmacia" = ?
  `);

  return stmt.get(id);
}

// editar
export function editar(id, data) {
  const stmt = db.prepare(/*sql*/ `
    UPDATE "tbFarmacia"
    SET
      "nomeFarmacia" = ?,
      "emailFarmacia" = ?,
      "telFarmacia" = ?,
      "cnesFarmacia" = ?,
      "senhaFarmacia" = ?,
      "idGerente" = ?,
      "cepFarmacia" = ?,
      "enderecoFarmacia" = ?,
      "numeroFarmacia" = ?,
      "complementoFarmacia" = ?,
      "bairroFarmacia" = ?,
      "cidadeFarmacia" = ?
    WHERE "idFarmacia" = ?
  `);

  return stmt.run(
    data.nomeFarmacia,
    data.emailFarmacia,
    data.telFarmacia,
    data.cnesFarmacia,
    data.senhaFarmacia,
    data.idGerente,
    data.cepFarmacia,
    data.enderecoFarmacia,
    data.numeroFarmacia,
    data.complementoFarmacia ?? null,
    data.bairroFarmacia,
    data.cidadeFarmacia,
    id,
  );
}

// deletar
export function deletar(id) {
  const stmt = db.prepare(/*sql*/ `
    DELETE FROM "tbFarmacia"
    WHERE "idFarmacia" = ?
  `);

  return stmt.run(id);
}
