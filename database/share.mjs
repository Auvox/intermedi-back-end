import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import path from "node:path";
import { abrirBanco, aplicarSchema, caminhoDoBanco } from "./setup.mjs";
import { exigirMain, publicarDados, raizProjeto, sincronizarDados } from "./shared-data.mjs";

let db;
try {
  exigirMain();
  const [comando, origem] = process.argv.slice(2);
  if (comando === "publish") {
    const caminho = origem ? path.resolve(origem) : caminhoDoBanco();
    if (!existsSync(caminho)) {
      throw new Error("Banco não encontrado. Use db:init ou informe o banco: npm run db:publish -- database/intermedi.db");
    }
    db = new DatabaseSync(caminho, { readOnly: true });
    const arquivo = publicarDados(db);
    console.log(`Dados preparados: ${arquivo}`);
    console.log("Revise o arquivo e inclua-o no commit da main. Nenhum commit/push foi feito.");
  } else if (comando === "sync") {
    db = abrirBanco();
    aplicarSchema(db);
    const backup = path.join(raizProjeto, "database", `antes-sync-${Date.now()}.db`);
    const resultado = sincronizarDados(db, { substituir: true, backup });
    console.log(resultado === "sem-publicacao" ? "Ainda não existe database/main-data.json."
      : `Dados sincronizados. Banco anterior preservado em: ${backup}`);
  } else {
    throw new Error("Use npm run db:publish ou npm run db:sync.");
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  db?.close();
}
