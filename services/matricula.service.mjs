import db from "../database/database.mjs";

const TABELAS = new Set(["funcionario", "gerente"]);

// Gera uma matrícula de 6 dígitos (com prefixo opcional) que ainda não existe
export function gerarMatriculaUnica(tabela, prefixo = "") {
  if (!TABELAS.has(tabela)) throw new Error(`Tabela sem matrícula: ${tabela}`);

  const existe = db.prepare(`SELECT 1 FROM ${tabela} WHERE matricula = ?`);

  for (let i = 0; i < 10; i++) {
    const numero = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    const matricula = prefixo + numero;
    if (!existe.get(matricula)) return matricula;
  }

  throw new Error("Não foi possível gerar uma matrícula única.");
}
