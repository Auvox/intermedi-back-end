import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL("../", import.meta.url));
let dentroDoGit = false;
try {
  execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: raiz, stdio: "ignore" });
  dentroDoGit = true;
  let atual = "";
  try {
    atual = execFileSync("git", ["config", "--local", "--get", "core.hooksPath"],
      { cwd: raiz, encoding: "utf8" }).trim();
  } catch (error) {
    if (error.status !== 1) throw error;
  }
  if (atual && atual !== ".githooks") {
    console.warn(`Hook não instalado: core.hooksPath já aponta para ${atual}.`);
  } else {
    execFileSync("git", ["config", "--local", "core.hooksPath", ".githooks"], { cwd: raiz });
    console.log("Hook de publicação do banco instalado.");
  }
} catch (error) {
  // npm install também pode rodar fora de um clone Git.
  console.warn(`Hook não instalado: ${error.message}`);
  if (dentroDoGit) process.exitCode = 1;
}
