import db, { emTransacao } from "../database/database.mjs";
import { erro } from "../utils/http.mjs";
import { idOuNull, mesclar, texto, textoOuNull } from "../utils/dados.mjs";
import { gerarHashSenha, gerarSenhaProvisoria } from "../utils/senha.mjs";
import { colunasEndereco, lerEndereco, salvarEndereco } from "./endereco.service.mjs";
import { gerarMatriculaUnica } from "./matricula.service.mjs";
import { farmaciaDoPayload } from "./farmacia.service.mjs";

const CAMPOS_ENDERECO = {
  logradouro: "enderecoFuncionario",
  numero: "numeroFuncionario",
  complemento: "complementoFuncionario",
  bairro: "bairroFuncionario",
  cidade: "cidadeFuncionario",
  uf: ["estadoFuncionario", "ufFuncionario"],
  cep: "cepFuncionario",
};

const SELECT_FUNCIONARIO = /*sql*/ `
  SELECT
      fu.id_funcionario      AS idFuncionario,
      fu.nome                AS nomeFuncionario,
      fu.cpf                 AS cpfFuncionario,
      fu.email               AS emailFuncionario,
      fu.matricula           AS matriculaFuncionario,
      fu.telefone            AS telFuncionario,
      fu.cargo               AS cargoFuncionario,
      fu.turno               AS turnoFuncionario,
      fu.id_farmacia         AS fkIdFarmacia,
      f.nome                 AS nomeFarmacia,
      fu.id_gerente_cadastro AS idGerenteCadastro,
      fu.created_at          AS createdAtFuncionario,
      fu.id_endereco         AS idEndereco,
      ${colunasEndereco({
        cep: "cepFuncionario", logradouro: "enderecoFuncionario", numero: "numeroFuncionario",
        complemento: "complementoFuncionario", bairro: "bairroFuncionario",
        cidade: "cidadeFuncionario", uf: "ufFuncionario",
      })}
  FROM funcionario fu
  INNER JOIN farmacia f ON f.id_farmacia = fu.id_farmacia
  LEFT  JOIN endereco e ON e.id_endereco = fu.id_endereco
`;

// "Manhã", "MANHA", "manha" -> "manha"
const TURNOS = ["manha", "tarde", "noite", "integral"];
export function normalizarTurno(valor) {
  const turno = texto(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (!turno) return null;
  if (!TURNOS.includes(turno)) {
    throw erro(400, "Turno inválido. Use: manha, tarde, noite ou integral.");
  }
  return turno;
}

function validar(dados) {
  const faltando = ["nomeFuncionario", "cpfFuncionario", "emailFuncionario"]
    .filter((campo) => !texto(dados[campo]));
  if (faltando.length) throw erro(400, `Campos obrigatórios: ${faltando.join(", ")}.`);

}

function conferirDuplicado(cpf, email, idIgnorar = -1) {
  const existente = db.prepare(/*sql*/ `
    SELECT cpf, email FROM funcionario
    WHERE id_funcionario <> ? AND (cpf = ? OR email = ?)
  `).get(idIgnorar, cpf, email);

  if (existente?.cpf === cpf) throw erro(409, "CPF já cadastrado.");
  if (existente) throw erro(409, "E-mail já cadastrado.");
}

// cadastrar
export function cadastrar(data) {
  const idFarmacia = farmaciaDoPayload(data);
  const idGerente = idOuNull(data.idGerenteCadastro);
  validar(data);
  if (Number.isNaN(idGerente)) throw erro(400, "idGerenteCadastro inválido.");
  if (idGerente && !db.prepare("SELECT 1 FROM gerente WHERE id_gerente = ?").get(idGerente)) {
    throw erro(400, "O gerente informado não existe.");
  }

  const cpf = texto(data.cpfFuncionario);
  const email = texto(data.emailFuncionario);
  conferirDuplicado(cpf, email);

  const turno = normalizarTurno(data.turnoFuncionario);
  const endereco = lerEndereco(data, CAMPOS_ENDERECO);

  // sem senha no cadastro -> gera uma provisória e devolve na resposta
  const senhaInformada = texto(data.senhaFuncionario);
  const senhaProvisoria = senhaInformada ? undefined : gerarSenhaProvisoria();

  return emTransacao(() => {
    const idEndereco = salvarEndereco(null, endereco);
    // matrícula gerada aqui no back
    const matriculaFuncionario = gerarMatriculaUnica("funcionario");

    const result = db.prepare(/*sql*/ `
      INSERT INTO funcionario
          (nome, cpf, email, senha_hash, matricula, telefone, cargo, turno,
           id_farmacia, id_gerente_cadastro, id_endereco)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      texto(data.nomeFuncionario),
      cpf,
      email,
      gerarHashSenha(senhaInformada || senhaProvisoria),
      matriculaFuncionario,
      textoOuNull(data.telFuncionario),
      textoOuNull(data.cargoFuncionario),
      turno,
      idFarmacia,
      idGerente,
      idEndereco,
    );

    return {
      idFuncionario: Number(result.lastInsertRowid),
      matriculaFuncionario,
      fkIdFarmacia: idFarmacia,
      idEndereco,
      senhaProvisoria,
    };
  });
}

// listar
export function listar() {
  return db.prepare(`${SELECT_FUNCIONARIO} ORDER BY f.nome, fu.nome`).all();
}

// busca individual
export function buscarPorId(id) {
  return db.prepare(`${SELECT_FUNCIONARIO} WHERE fu.id_funcionario = ?`).get(id);
}

// editar (campos não enviados continuam iguais; senha só muda se vier preenchida)
export function editar(id, data) {
  const atual = buscarPorId(id);
  if (!atual) return { changes: 0 };

  const dados = mesclar(atual, data);
  const idFarmacia = farmaciaDoPayload(data, atual.fkIdFarmacia);
  validar(dados);

  const cpf = texto(dados.cpfFuncionario);
  const email = texto(dados.emailFuncionario);
  conferirDuplicado(cpf, email, id);

  const turno = normalizarTurno(dados.turnoFuncionario);
  const endereco = lerEndereco(dados, CAMPOS_ENDERECO);
  const novaSenha = texto(data.senhaFuncionario);

  return emTransacao(() => {
    const idEndereco = salvarEndereco(atual.idEndereco, endereco);

    const result = db.prepare(/*sql*/ `
      UPDATE funcionario
      SET nome = ?, cpf = ?, email = ?, matricula = ?, telefone = ?,
          cargo = ?, turno = ?, id_farmacia = ?, id_endereco = ?,
          senha_hash = COALESCE(?, senha_hash)
      WHERE id_funcionario = ?
    `).run(
      texto(dados.nomeFuncionario),
      cpf,
      email,
      texto(dados.matriculaFuncionario),
      textoOuNull(dados.telFuncionario),
      textoOuNull(dados.cargoFuncionario),
      turno,
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
    const atual = db.prepare("SELECT id_endereco FROM funcionario WHERE id_funcionario = ?").get(id);
    if (!atual) return { changes: 0 };

    const result = db.prepare("DELETE FROM funcionario WHERE id_funcionario = ?").run(id);
    if (atual.id_endereco) salvarEndereco(atual.id_endereco, null);

    return { changes: Number(result.changes) };
  });
}
