import db from "../database/database.mjs";
import { erro } from "../utils/http.mjs";
import { texto } from "../utils/dados.mjs";

// UF usada quando o front não manda estado/uf
export const UF_PADRAO = "SP";

const OBRIGATORIOS = ["logradouro", "numero", "bairro", "cidade", "cep"];

// Lê o endereço do payload usando os nomes de campo de cada entidade.
// campos = { logradouro: "ruaPaciente", uf: ["estadoPaciente"], ... }
// Retorna null quando nenhum campo de endereço foi preenchido.
export function lerEndereco(data, campos) {
  const valor = (chave) => {
    for (const nome of [].concat(campos[chave] ?? [])) {
      const v = texto(data[nome]);
      if (v) return v;
    }
    return "";
  };

  // Complemento/UF isolados também são um endereço parcial, não ausência dele.
  if (!Object.keys(campos).some((chave) => valor(chave))) return null;

  const endereco = {
    logradouro: valor("logradouro"),
    numero: valor("numero"),
    complemento: valor("complemento") || null,
    bairro: valor("bairro"),
    cidade: valor("cidade"),
    uf: valor("uf").toUpperCase() || UF_PADRAO,
    cep: valor("cep"),
  };

  const faltando = OBRIGATORIOS.filter((chave) => !endereco[chave]);
  if (faltando.length) {
    const nomes = faltando.map((chave) => [].concat(campos[chave])[0]);
    throw erro(400, `Endereço incompleto. Faltou: ${nomes.join(", ")}.`);
  }
  if (!/^[A-Z]{2}$/.test(endereco.uf)) {
    throw erro(400, "UF inválida: use a sigla com 2 letras (ex.: SP).");
  }
  return endereco;
}

// Cria/atualiza/remove o endereço e devolve o id_endereco a gravar na entidade
export function salvarEndereco(idAtual, endereco) {
  if (!endereco) {
    if (idAtual) removerEndereco(idAtual);
    return null;
  }

  const valores = [
    endereco.logradouro, endereco.numero, endereco.complemento,
    endereco.bairro, endereco.cidade, endereco.uf, endereco.cep,
  ];

  if (idAtual) {
    db.prepare(/*sql*/ `
      UPDATE endereco
      SET logradouro = ?, numero = ?, complemento = ?, bairro = ?,
          cidade = ?, uf = ?, cep = ?
      WHERE id_endereco = ?
    `).run(...valores, idAtual);
    return idAtual;
  }

  const result = db.prepare(/*sql*/ `
    INSERT INTO endereco (logradouro, numero, complemento, bairro, cidade, uf, cep)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(...valores);
  return Number(result.lastInsertRowid);
}

export function removerEndereco(idEndereco) {
  db.prepare("DELETE FROM endereco WHERE id_endereco = ?").run(idEndereco);
}

// Colunas de endereço já com os apelidos de cada entidade (para os SELECT)
export function colunasEndereco(nomes) {
  return Object.entries(nomes)
    .map(([coluna, apelido]) => `e.${coluna} AS "${apelido}"`)
    .join(",\n      ");
}
