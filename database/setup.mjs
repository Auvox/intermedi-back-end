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
  const temColuna = (tabela, coluna) =>
    db.prepare(`PRAGMA table_info(${tabela})`).all().some((c) => c.name === coluna);
  if (!temColuna("paciente", "senha_hash") || !temColuna("chamado", "id_gerente_resposta") ||
      !temColuna("remedio", "registro_anvisa") || !temColuna("estoque", "estoque_minimo") ||
      !temColuna("redistribuicao", "data_prevista_chegada") || !temColuna("funcionario", "foto")) {
    throw new Error(
      "O banco foi criado com uma versão antiga do schema. " +
        "Pare o servidor e rode: npm run db:reset",
    );
  }
  migrarRedistribuicao(db);
  migrarLoginAdmin(db, temColuna);
}

// Bancos criados antes do login por matrícula: o admin ganha cpf e matricula
// (vazios; npm run admin:criar preenche). Os índices UNIQUE ficam aqui porque
// o schema.sql roda antes do ALTER TABLE nos bancos antigos.
function migrarLoginAdmin(db, temColuna) {
  for (const coluna of ["cpf", "matricula"]) {
    if (!temColuna("admin", coluna)) db.exec(`ALTER TABLE admin ADD COLUMN ${coluna} TEXT`);
  }
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_cpf ON admin (cpf)");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_matricula ON admin (matricula)");
}

// Bancos criados antes do status "preparando": o SQLite não altera o CHECK de
// uma tabela existente, então a tabela redistribuicao é recriada com o schema
// novo e TODOS os registros são copiados (não precisa de db:reset).
function migrarRedistribuicao(db) {
  const { sql = "" } = db.prepare(
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'redistribuicao'",
  ).get() ?? {};
  if (sql.includes("'preparando'")) return;

  const colunas = db.prepare("PRAGMA table_info(redistribuicao)").all()
    .map((c) => `"${c.name}"`).join(", ");
  db.exec("PRAGMA foreign_keys = OFF");
  db.exec("BEGIN");
  try {
    db.exec("ALTER TABLE redistribuicao RENAME TO redistribuicao_antes_preparo");
    db.exec(lerSql("schema.sql")); // cria só o que falta: a tabela nova
    db.exec(`INSERT INTO redistribuicao (${colunas}) SELECT ${colunas} FROM redistribuicao_antes_preparo`);
    db.exec("DROP TABLE redistribuicao_antes_preparo");
    if (db.prepare("PRAGMA foreign_key_check(redistribuicao)").all().length) {
      throw new Error("Migração do status 'preparando': referências inválidas em redistribuicao.");
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }
  console.log("Banco atualizado: pedidos entre farmácias agora têm o status 'preparando'.");
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
