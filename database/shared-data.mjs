import { createHash } from "node:crypto";
import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const raizProjeto = fileURLToPath(new URL("../", import.meta.url));
// Ordem das dependências: endereço antes de pessoas, farmácia antes de estoque etc.
const TABELAS = [
  "endereco", "admin", "farmacia", "categoria", "paciente", "gerente", "funcionario",
  "remedio", "remedio_categoria", "estoque", "chamado", "chamado_remedio",
  "servico", "servico_remedio", "redistribuicao",
];

export function branchAtual(raiz = raizProjeto) {
  const entrada = path.join(raiz, ".git");
  if (!existsSync(entrada)) return null;
  const diretorio = statSync(entrada).isDirectory() ? entrada
    : path.resolve(raiz, readFileSync(entrada, "utf8").trim().replace(/^gitdir:\s*/, ""));
  return readFileSync(path.join(diretorio, "HEAD"), "utf8").trim()
    .match(/^ref: refs\/heads\/(.+)$/)?.[1] ?? null;
}

export function exigirMain(raiz = raizProjeto) {
  if (branchAtual(raiz) !== "main") {
    throw new Error("Este comando só pode ser executado na branch main.");
  }
}

export function caminhoLocal(raiz = raizProjeto) {
  return path.join(raiz, "database", branchAtual(raiz) === "main" ? "intermedi.main.db" : "intermedi.db");
}

const arquivoCompartilhado = (raiz) => path.join(raiz, "database", "main-data.json");
const hash = (dados) => createHash("sha256").update(JSON.stringify(dados)).digest("hex");
const colunas = (db, tabela) => db.prepare(`PRAGMA table_info("${tabela}")`).all();

// Somente dados: sessões de login e metadados locais nunca são publicados.
export function lerDados(db) {
  return Object.fromEntries(TABELAS.map((tabela) => {
    const info = colunas(db, tabela);
    if (!info.length) throw new Error(`Tabela ${tabela} ausente. Confira o schema do banco.`);
    const ordem = info.filter((coluna) => coluna.pk).sort((a, b) => a.pk - b.pk)
      .map((coluna) => `"${coluna.name}"`).join(", ");
    return [tabela, db.prepare(`SELECT * FROM "${tabela}" ORDER BY ${ordem}`).all()];
  }));
}

function validarDados(db, snapshot) {
  if (snapshot?.version !== 1 || !snapshot.tables ||
      Object.keys(snapshot.tables).length !== TABELAS.length) {
    throw new Error("Arquivo main-data.json inválido ou de versão incompatível.");
  }
  for (const tabela of TABELAS) {
    const campos = colunas(db, tabela).map((coluna) => coluna.name);
    const registros = snapshot.tables[tabela];
    if (!Array.isArray(registros) || registros.some((registro) =>
      !registro || Object.keys(registro).length !== campos.length ||
      campos.some((campo) => !Object.hasOwn(registro, campo)),
    )) throw new Error(`Dados de ${tabela} incompatíveis com o schema atual.`);
  }
}

export function publicarDados(db, raiz = raizProjeto) {
  exigirMain(raiz);
  // Garante uma leitura consistente mesmo com outras conexões abertas.
  db.exec("BEGIN");
  let snapshot;
  try {
    if (db.prepare("PRAGMA foreign_key_check").all().length) {
      throw new Error("O banco contém chaves estrangeiras inválidas. Corrija antes de publicar.");
    }
    snapshot = { version: 1, tables: lerDados(db) };
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  const arquivo = arquivoCompartilhado(raiz);
  writeFileSync(arquivo + ".tmp", JSON.stringify(snapshot, null, 2) + "\n");
  renameSync(arquivo + ".tmp", arquivo);
  return arquivo;
}

export function sincronizarDados(db, { raiz = raizProjeto, substituir = false, backup } = {}) {
  if (branchAtual(raiz) !== "main") return "fora-da-main";
  const arquivo = arquivoCompartilhado(raiz);
  if (!existsSync(arquivo)) return "sem-publicacao";
  const snapshot = JSON.parse(readFileSync(arquivo, "utf8"));
  validarDados(db, snapshot);
  const novoHash = hash(snapshot.tables);

  // No modo manual, a cópia inclui o banco inteiro, inclusive as sessões locais.
  if (substituir) {
    if (!backup) throw new Error("Informe um caminho de backup para substituir os dados locais.");
    db.prepare("VACUUM INTO ?").run(backup);
  }
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec("CREATE TABLE IF NOT EXISTS _dados_main (id INTEGER PRIMARY KEY CHECK (id = 1), hash TEXT NOT NULL)");
    const anterior = db.prepare("SELECT hash FROM _dados_main WHERE id = 1").get()?.hash;
    const dadosLocais = lerDados(db);
    const hashLocal = hash(dadosLocais);
    const vazio = Object.values(dadosLocais).every((registros) => registros.length === 0);

    // Mesmo snapshot: os cadastros feitos localmente devem continuar como estão.
    if (!substituir && anterior === novoHash) {
      db.exec("COMMIT");
      return "atualizado";
    }
    if (!substituir && !vazio && hashLocal !== novoHash && hashLocal !== anterior) {
      db.exec("COMMIT");
      return "alteracoes-locais";
    }

    if (hashLocal !== novoHash) {
      // Os dados vêm completos; excluir na ordem inversa preserva as FKs.
      db.exec("DELETE FROM sessao_paciente");
      for (const tabela of [...TABELAS].reverse()) db.exec(`DELETE FROM "${tabela}"`);
      for (const tabela of TABELAS) {
        const campos = colunas(db, tabela).map((coluna) => coluna.name);
        const inserir = db.prepare(`INSERT INTO "${tabela}" (${campos.map((c) => `"${c}"`).join(", ")}) VALUES (${campos.map(() => "?").join(", ")})`);
        for (const registro of snapshot.tables[tabela]) inserir.run(...campos.map((campo) => registro[campo]));
      }
      if (db.prepare("PRAGMA foreign_key_check").all().length) throw new Error("A publicação contém vínculos inválidos.");
    }
    db.prepare("INSERT OR REPLACE INTO _dados_main (id, hash) VALUES (1, ?)").run(novoHash);
    db.exec("COMMIT");
    return "sincronizado";
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function sincronizarAoIniciar(db) {
  // Testes e bancos configurados explicitamente não recebem dados da main.
  if (process.env.INTERMEDI_DB_PATH) return "banco-personalizado";
  const resultado = sincronizarDados(db);
  if (resultado === "sincronizado") console.log("Banco da main atualizado com database/main-data.json.");
  if (resultado === "alteracoes-locais") console.warn(
    "Dados locais preservados: há uma publicação diferente na main. " +
    "Use npm run db:sync para recebê-la com backup, ou db:publish para publicar seus dados.",
  );
  return resultado;
}
