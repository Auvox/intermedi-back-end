import db from "../database/database.mjs";

// cadastrar
export function cadastrar(data) {
  const {
    nomeGerente,
    emailGerente,
    senhaGerente,
    cpfGerente,
    crfGerente,
    cepGerente,
    enderecoGerente,
    numeroGerente,
    complementoGerente,
    bairroGerente,
    cidadeGerente,
  } = data;

  const stmt = db.prepare(/*sql*/ `
    INSERT OR IGNORE INTO "tbGerente" (
      "nomeGerente",
      "emailGerente",
      "senhaGerente",
      "cpfGerente",
      "crfGerente",
      "cepGerente",
      "enderecoGerente",
      "numeroGerente",
      "complementoGerente",
      "bairroGerente",
      "cidadeGerente"
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    nomeGerente,
    emailGerente,
    senhaGerente,
    cpfGerente,
    crfGerente,
    cepGerente,
    enderecoGerente,
    numeroGerente,
    complementoGerente ?? null,
    bairroGerente,
    cidadeGerente,
  );

  return {
    idGerente: Number(result.lastInsertRowid),
  };
}

// listar
export function listar() {
  const stmt = db.prepare(/*sql*/ `
    SELECT * FROM "tbGerente"
  `);

  return stmt.all();
}

// busca individual
export function buscarPorId(id) {
  const stmt = db.prepare(/*sql*/ `
    SELECT *
    FROM "tbGerente"
    WHERE "idGerente" = ?
  `);

  return stmt.get(id);
}

// editar
export function editar(id, data) {
  const stmt = db.prepare(/*sql*/ `
    UPDATE "tbGerente"
    SET
      "nomeGerente" = ?,
      "emailGerente" = ?,
      "senhaGerente" = ?,
      "cpfGerente" = ?,
      "crfGerente" = ?,
      "cepGerente" = ?,
      "enderecoGerente" = ?,
      "numeroGerente" = ?,
      "complementoGerente" = ?,
      "bairroGerente" = ?,
      "cidadeGerente" = ?
    WHERE "idGerente" = ?
  `);

  return stmt.run(
    data.nomeGerente,
    data.emailGerente,
    data.senhaGerente,
    data.cpfGerente,
    data.crfGerente,
    data.cepGerente,
    data.enderecoGerente,
    data.numeroGerente,
    data.complementoGerente ?? null,
    data.bairroGerente,
    data.cidadeGerente,
    id,
  );
}

// deletar
export function deletar(id) {
  const stmt = db.prepare(/*sql*/ `
    DELETE FROM "tbGerente"
    WHERE "idGerente" = ?
  `);

  return stmt.run(id);
}
