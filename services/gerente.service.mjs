import db, { emTransacao } from "../database/database.mjs";
import { erro } from "../utils/http.mjs";
import * as serviceFuncionario from "../services/funcionario.service.mjs";
import { idOuNull, mesclar, texto, textoOuNull } from "../utils/dados.mjs";
import { gerarHashSenha, gerarSenhaProvisoria } from "../utils/senha.mjs";
import { colunasEndereco, lerEndereco, salvarEndereco } from "./endereco.service.mjs";
import { gerarMatriculaUnica } from "./matricula.service.mjs";

const CAMPOS_ENDERECO = {
  logradouro: "enderecoGerente",
  numero: "numeroGerente",
  complemento: "complementoGerente",
  bairro: "bairroGerente",
  cidade: "cidadeGerente",
  uf: ["estadoGerente", "ufGerente"],
  cep: "cepGerente",
};

// A senha (senha_hash) nunca sai no SELECT
const SELECT_GERENTE = /*sql*/ `
  SELECT
      g.id_gerente        AS idGerente,
      g.nome              AS nomeGerente,
      g.email             AS emailGerente,
      g.cpf               AS cpfGerente,
      g.crf               AS crfGerente,
      g.matricula         AS matriculaGerente,
      g.telefone          AS telGerente,
      g.id_farmacia       AS fkIdFarmacia,
      f.nome              AS nomeFarmacia,
      g.id_admin_cadastro AS idAdminCadastro,
      g.created_at        AS createdAtGerente,
      g.id_endereco       AS idEndereco,
      ${colunasEndereco({
        cep: "cepGerente", logradouro: "enderecoGerente", numero: "numeroGerente",
        complemento: "complementoGerente", bairro: "bairroGerente",
        cidade: "cidadeGerente", uf: "ufGerente",
      })}
  FROM gerente g
  INNER JOIN farmacia f ON f.id_farmacia = g.id_farmacia
  LEFT  JOIN endereco e ON e.id_endereco = g.id_endereco
`;

// Aceita fkIdFarmacia ou idFarmacia
const farmaciaDoPayload = (data) => data.fkIdFarmacia ?? data.idFarmacia;

function validar(dados, idFarmacia) {
  const faltando = ["nomeGerente", "emailGerente", "cpfGerente", "crfGerente"]
    .filter((campo) => !texto(dados[campo]));
  if (faltando.length) throw erro(400, `Campos obrigatórios: ${faltando.join(", ")}.`);

  if (!idFarmacia) {
    throw erro(400, "Informe fkIdFarmacia (a farmácia do gerente).");
  }
  if (Number.isNaN(idFarmacia)) throw erro(400, "fkIdFarmacia inválido.");
}

// cadastrar
export function cadastrar(data) {
  const idFarmacia = idOuNull(farmaciaDoPayload(data));
  const idAdmin = idOuNull(data.idAdminCadastro);
  validar(data, idFarmacia);
  if (Number.isNaN(idAdmin)) throw erro(400, "idAdminCadastro inválido.");
  const endereco = lerEndereco(data, CAMPOS_ENDERECO);

  // sem senha no cadastro -> gera uma provisória e devolve na resposta
  const senhaInformada = texto(data.senhaGerente);
  const senhaProvisoria = senhaInformada ? undefined : gerarSenhaProvisoria();

  return emTransacao(() => {
    const idEndereco = salvarEndereco(null, endereco);
    const matriculaGerente = gerarMatriculaUnica("gerente", "G");

    const result = db.prepare(/*sql*/ `
      INSERT INTO gerente
          (nome, email, senha_hash, cpf, crf, matricula, telefone,
           id_farmacia, id_admin_cadastro, id_endereco)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      texto(data.nomeGerente),
      texto(data.emailGerente),
      gerarHashSenha(senhaInformada || senhaProvisoria),
      texto(data.cpfGerente),
      texto(data.crfGerente),
      matriculaGerente,
      textoOuNull(data.telGerente),
      idFarmacia,
      idAdmin,
      idEndereco,
    );

    return { idGerente: Number(result.lastInsertRowid), matriculaGerente, senhaProvisoria };
  });
}

// listar
export function listar() {
  return db.prepare(`${SELECT_GERENTE} ORDER BY f.nome, g.nome`).all();
}

// busca individual
export function buscarPorId(id) {
  return db.prepare(`${SELECT_GERENTE} WHERE g.id_gerente = ?`).get(id);
}

// Adicione/substitua no gerente.service.mjs

export function consultarFuncionarioDoGerente(idGerente, idFuncionario) {
  // 1. Busca os dados do gerente para identificar a sua farmácia
  const gerente = db.prepare("SELECT id_farmacia FROM gerente WHERE id_gerente = ?").get(idGerente);
  if (!gerente) {
    throw erro(404, "Gerente não encontrado.");
  }

  // 2. Busca o funcionário e valida se ele pertence à mesma farmácia do gerente
  const funcionario = serviceFuncionario.buscarPorId(idFuncionario);
  
  if (!funcionario) {
    throw erro(404, "Funcionário não encontrado.");
  }

  // Regra de segurança: O funcionário deve pertencer à mesma farmácia do gerente
  if (funcionario.fkIdFarmacia !== gerente.id_farmacia) {
    throw erro(403, "Acesso negado: Este funcionário não pertence à sua farmácia.");
  }

  return funcionario;
}

// editar (campos não enviados continuam iguais; senha só muda se vier preenchida)
export function editar(id, data) {
  const atual = buscarPorId(id);
  if (!atual) return { changes: 0 };

  const dados = mesclar(atual, data);
  const idFarmacia = idOuNull(farmaciaDoPayload(data) ?? atual.fkIdFarmacia);
  validar(dados, idFarmacia);
  const endereco = lerEndereco(dados, CAMPOS_ENDERECO);
  const novaSenha = texto(data.senhaGerente);

  return emTransacao(() => {
    const idEndereco = salvarEndereco(atual.idEndereco, endereco);

    const result = db.prepare(/*sql*/ `
      UPDATE gerente
      SET nome = ?, email = ?, cpf = ?, crf = ?, matricula = ?, telefone = ?,
          id_farmacia = ?, id_endereco = ?,
          senha_hash = COALESCE(?, senha_hash)
      WHERE id_gerente = ?
    `).run(
      texto(dados.nomeGerente),
      texto(dados.emailGerente),
      texto(dados.cpfGerente),
      texto(dados.crfGerente),
      texto(dados.matriculaGerente),
      textoOuNull(dados.telGerente),
      idFarmacia,
      idEndereco,
      novaSenha ? gerarHashSenha(novaSenha) : null,
      id,
    );

    return { changes: Number(result.changes) };
  });
}

// deletar
export function deletar(id) {
  return emTransacao(() => {
    const atual = db.prepare("SELECT id_endereco FROM gerente WHERE id_gerente = ?").get(id);
    if (!atual) return { changes: 0 };

    const result = db.prepare("DELETE FROM gerente WHERE id_gerente = ?").run(id);
    if (atual.id_endereco) salvarEndereco(atual.id_endereco, null);

    return { changes: Number(result.changes) };
  });
}
