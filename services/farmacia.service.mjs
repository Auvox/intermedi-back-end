import db, { emTransacao } from "../database/database.mjs";
import { erro } from "../utils/http.mjs";
import { idOuNull, mesclar, texto, textoOuNull } from "../utils/dados.mjs";
import { colunasEndereco, lerEndereco, salvarEndereco } from "./endereco.service.mjs";

// Nomes que o front usa para o endereço da farmácia
const CAMPOS_ENDERECO = {
  logradouro: "enderecoFarmacia",
  numero: "numeroFarmacia",
  complemento: "complementoFarmacia",
  bairro: "bairroFarmacia",
  cidade: "cidadeFarmacia",
  uf: ["estadoFarmacia", "ufFarmacia"],
  cep: "cepFarmacia",
};

// SELECT com apelidos no formato que o front já conhece
const SELECT_FARMACIA = /*sql*/ `
  SELECT
      f.id_farmacia AS idFarmacia,
      f.nome        AS nomeFarmacia,
      f.email       AS emailFarmacia,
      f.telefone    AS telFarmacia,
      f.cnes        AS cnesFarmacia,
      f.id_endereco AS idEndereco,
      ${colunasEndereco({
        cep: "cepFarmacia", logradouro: "enderecoFarmacia", numero: "numeroFarmacia",
        complemento: "complementoFarmacia", bairro: "bairroFarmacia",
        cidade: "cidadeFarmacia", uf: "ufFarmacia",
      })}
  FROM farmacia f
  LEFT JOIN endereco e ON e.id_endereco = f.id_endereco
`;

function validar(dados) {
  if (!texto(dados.nomeFarmacia) || !texto(dados.cnesFarmacia)) {
    throw erro(400, "Informe nomeFarmacia e cnesFarmacia.");
  }
}

// O vínculo fica em gerente/funcionario.id_farmacia, sempre com um ID real.
export function farmaciaDoPayload(data, idAtual = null) {
  const idFarmacia = idOuNull(data.fkIdFarmacia ?? data.idFarmacia ?? idAtual);
  if (!Number.isInteger(idFarmacia) || idFarmacia <= 0) {
    throw erro(400, "Selecione uma farmácia cadastrada (fkIdFarmacia).");
  }
  if (data.fkIdFarmacia != null && data.idFarmacia != null &&
      idOuNull(data.fkIdFarmacia) !== idOuNull(data.idFarmacia)) {
    throw erro(400, "fkIdFarmacia e idFarmacia devem indicar a mesma farmácia.");
  }
  if (!db.prepare("SELECT 1 FROM farmacia WHERE id_farmacia = ?").get(idFarmacia)) {
    throw erro(400, "A farmácia selecionada não existe.");
  }
  return idFarmacia;
}

// cadastrar
export function cadastrar(data) {
  validar(data);
  const endereco = lerEndereco(data, CAMPOS_ENDERECO);

  return emTransacao(() => {
    const idEndereco = salvarEndereco(null, endereco);

    const result = db.prepare(/*sql*/ `
      INSERT INTO farmacia (nome, email, telefone, cnes, id_endereco)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      texto(data.nomeFarmacia),
      textoOuNull(data.emailFarmacia),
      textoOuNull(data.telFarmacia),
      texto(data.cnesFarmacia),
      idEndereco,
    );

    return { idFarmacia: Number(result.lastInsertRowid), idEndereco };
  });
}

// listar
export function listar() {
  return db.prepare(`${SELECT_FARMACIA} ORDER BY f.nome`).all();
}

// busca individual
export function buscarPorId(id) {
  return db.prepare(`${SELECT_FARMACIA} WHERE f.id_farmacia = ?`).get(id);
}

// editar (campos não enviados continuam iguais)
export function editar(id, data) {
  const atual = buscarPorId(id);
  if (!atual) return { changes: 0 };

  const dados = mesclar(atual, data);
  validar(dados);
  const endereco = lerEndereco(dados, CAMPOS_ENDERECO);

  return emTransacao(() => {
    const idEndereco = salvarEndereco(atual.idEndereco, endereco);

    const result = db.prepare(/*sql*/ `
      UPDATE farmacia
      SET nome = ?, email = ?, telefone = ?, cnes = ?, id_endereco = ?
      WHERE id_farmacia = ?
    `).run(
      texto(dados.nomeFarmacia),
      textoOuNull(dados.emailFarmacia),
      textoOuNull(dados.telFarmacia),
      texto(dados.cnesFarmacia),
      idEndereco,
      id,
    );

    return { changes: Number(result.changes) };
  });
}

// deletar
// (bloqueado pelo banco se a farmácia ainda tiver gerentes/funcionários)
export function deletar(id) {
  return emTransacao(() => {
    const atual = db.prepare("SELECT id_endereco FROM farmacia WHERE id_farmacia = ?").get(id);
    if (!atual) return { changes: 0 };

    const result = db.prepare("DELETE FROM farmacia WHERE id_farmacia = ?").run(id);
    if (atual.id_endereco) salvarEndereco(atual.id_endereco, null);

    return { changes: Number(result.changes) };
  });
}
