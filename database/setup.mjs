import { DatabaseSync } from "node:sqlite";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { caminhoLocal } from "./shared-data.mjs";

// Caminho do banco:
//   • padrão: database/intermedi.db
//   • pode trocar com a variável INTERMEDI_DB_PATH (os testes usam isso)
export function caminhoDoBanco() {
  return (
    process.env.INTERMEDI_DB_PATH ||
    caminhoLocal()
  );
}

const lerSql = (arquivo) =>
  readFileSync(new URL(`./${arquivo}`, import.meta.url), "utf8");

export function abrirBanco(caminho = caminhoDoBanco()) {
  const db = new DatabaseSync(caminho);
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
}

// Cria as tabelas que ainda não existem (pode rodar sempre)
export function aplicarSchema(db) {
  db.exec(lerSql("schema.sql"));

  // Protege contra um intermedi.db criado com uma versão antiga do schema
  const colunas = db.prepare("PRAGMA table_info(paciente)").all();
  if (!colunas.some((c) => c.name === "senha_hash")) {
    throw new Error(
      "O banco foi criado com uma versão antiga do schema. " +
        "Pare o servidor e rode: npm run db:reset",
    );
  }
}

// Insere os dados de teste (tudo ou nada)
export function aplicarSeed(db) {
  db.exec("BEGIN");
  try {
    db.exec(lerSql("seed.sql"));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function bancoVazio(db) {
  return !db.prepare("SELECT 1 FROM farmacia LIMIT 1").get();
}

// Apaga o arquivo do banco (e os arquivos auxiliares do SQLite)
export function apagarBanco(caminho = caminhoDoBanco()) {
  for (const sufixo of ["", "-journal", "-wal", "-shm"]) {
    try {
      rmSync(caminho + sufixo, { force: true });
    } catch (error) {
      if (error.code === "EBUSY" || error.code === "EPERM") {
        throw new Error(
          "O banco está em uso. Pare o servidor (Ctrl+C) e feche o banco " +
            "no VS Code/DB Browser antes de rodar o reset.",
        );
      }
      throw error;
    }
  }
}

export function bancoExiste(caminho = caminhoDoBanco()) {
  return existsSync(caminho);
}
