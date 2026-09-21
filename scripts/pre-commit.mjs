import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { caminhoDoBanco } from "../database/setup.mjs";
import { branchAtual, publicarDados, raizProjeto } from "../database/shared-data.mjs";

if (branchAtual() === "main") {
  const caminho = caminhoDoBanco();
  if (!existsSync(caminho)) {
    console.error(`Commit cancelado: banco da main não encontrado em ${caminho}. Rode npm run db:init.`);
    process.exitCode = 1;
  } else {
    let db;
    try {
      db = new DatabaseSync(caminho, { readOnly: true });
      publicarDados(db);
      execFileSync("git", ["add", "--", "database/main-data.json"], { cwd: raizProjeto });
      console.log("Dados da main incluídos no commit.");
    } catch (error) {
      console.error(`Commit cancelado: ${error.message}`);
      process.exitCode = 1;
    } finally {
      db?.close();
    }
  }
}
