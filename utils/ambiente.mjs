import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

// Resolve pela pasta do projeto, mesmo quando iniciado de outro diretório.
// Variáveis fornecidas pelo processo (inclusive vazias nos testes) prevalecem.
try {
  const valores = parseEnv(readFileSync(new URL("../.env", import.meta.url), "utf8"));
  for (const [chave, valor] of Object.entries(valores)) {
    if (process.env[chave] === undefined) process.env[chave] = valor;
  }
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
