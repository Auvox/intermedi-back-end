const { existsSync } = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const [major, minor] = process.versions.node.split(".").map(Number);
const compativel = major > 22 || (major === 22 && minor >= 13);
const local = path.join(__dirname, "..", ".runtime", "node.exe");
const executavel = compativel ? process.execPath : local;

if (!compativel && !existsSync(local)) {
  console.error(`Node ${process.versions.node} incompatível. Instale Node 24 LTS e reabra o terminal. O projeto exige Node >=22.13.`);
  process.exit(1);
}

const resultado = spawnSync(executavel, process.argv.slice(2), { stdio: "inherit" });
if (resultado.error) console.error(resultado.error.message);
process.exit(resultado.status ?? 1);
