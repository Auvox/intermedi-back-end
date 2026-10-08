import db from "../database/database.mjs";

// Tabelas que têm a coluna "foto" (pessoas e farmácias)
const TABELAS = {
  funcionario: "id_funcionario",
  gerente: "id_gerente",
  farmacia: "id_farmacia",
};

// Grava a URL nova e devolve a antiga (para apagar o arquivo).
// undefined = registro não existe.
export function atualizarFoto(tabela, id, url) {
  const chave = TABELAS[tabela];
  if (!chave) throw new Error(`Tabela sem foto: ${tabela}`);

  const atual = db.prepare(`SELECT foto FROM ${tabela} WHERE ${chave} = ?`).get(id);
  if (!atual) return undefined;
  db.prepare(`UPDATE ${tabela} SET foto = ? WHERE ${chave} = ?`).run(url, id);
  return atual.foto;
}

export function existe(tabela, id) {
  const chave = TABELAS[tabela];
  if (!chave) throw new Error(`Tabela sem foto: ${tabela}`);
  return Boolean(db.prepare(`SELECT 1 FROM ${tabela} WHERE ${chave} = ?`).get(id));
}
