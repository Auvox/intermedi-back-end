import db, { emTransacao } from "../database/database.mjs";
import { erro } from "../utils/http.mjs";
import { idOuNull, mesclar, texto, textoOuNull } from "../utils/dados.mjs";
import { gerarHashSenha, gerarSenhaProvisoria } from "../utils/senha.mjs";
import {
  colunasEndereco,
  lerEndereco,
  salvarEndereco,
} from "./endereco.service.mjs";
import { gerarMatriculaUnica } from "./matricula.service.mjs";
import { farmaciaDoPayload } from "./farmacia.service.mjs";
import { baixar as baixarEstoque } from "./estoque.service.mjs";

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
      fu.foto                AS fotoFuncionario,
      fu.created_at          AS createdAtFuncionario,
      fu.id_endereco         AS idEndereco,
      ${colunasEndereco({
        cep: "cepFuncionario",
        logradouro: "enderecoFuncionario",
        numero: "numeroFuncionario",
        complemento: "complementoFuncionario",
        bairro: "bairroFuncionario",
        cidade: "cidadeFuncionario",
        uf: "ufFuncionario",
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
  const existente = db
    .prepare(
      /*sql*/ `
    SELECT cpf, email FROM funcionario
    WHERE id_funcionario <> ? AND (cpf = ? OR email = ?)
  `
    )
    .get(idIgnorar, cpf, email);

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

    const result = db
      .prepare(
        /*sql*/ `
      INSERT INTO funcionario
          (nome, cpf, email, senha_hash, matricula, telefone, cargo, turno,
           id_farmacia, id_gerente_cadastro, id_endereco)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
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
        idEndereco
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
  return db
    .prepare(`${SELECT_FUNCIONARIO} WHERE fu.id_funcionario = ?`)
    .get(id);
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

    const result = db
      .prepare(
        /*sql*/ `
      UPDATE funcionario
      SET nome = ?, cpf = ?, email = ?, matricula = ?, telefone = ?,
          cargo = ?, turno = ?, id_farmacia = ?, id_endereco = ?,
          senha_hash = COALESCE(?, senha_hash)
      WHERE id_funcionario = ?
    `
      )
      .run(
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
        id
      );

    return { changes: Number(result.changes) };
  });
}

// deletar
export function deletar(id) {
  return emTransacao(() => {
    const atual = db
      .prepare("SELECT id_endereco FROM funcionario WHERE id_funcionario = ?")
      .get(id);
    if (!atual) return { changes: 0 };

    const result = db
      .prepare("DELETE FROM funcionario WHERE id_funcionario = ?")
      .run(id);
    if (atual.id_endereco) salvarEndereco(atual.id_endereco, null);

    return { changes: Number(result.changes) };
  });
}

export function novoServico(data) {
  for (const campo of ["idFuncionario", "idPaciente", "idFarmacia"]) {
    if (!Number.isSafeInteger(data[campo]) || data[campo] <= 0) {
      throw erro(400, `${campo} deve ser um inteiro positivo.`);
    }
  }
  if (!Array.isArray(data.remedios) || data.remedios.length === 0) {
    throw erro(400, "Informe pelo menos um item em remedios.");
  }
  const ids = new Set();
  for (const item of data.remedios) {
    if (
      !Number.isSafeInteger(item?.idRemedio) ||
      item.idRemedio <= 0 ||
      !Number.isSafeInteger(item?.quantidade) ||
      item.quantidade <= 0
    ) {
      throw erro(
        400,
        "Cada remédio deve ter idRemedio e quantidade inteiros positivos."
      );
    }
    if (ids.has(item.idRemedio))
      throw erro(400, "Não repita o mesmo remédio na lista.");
    ids.add(item.idRemedio);
  }

  return emTransacao(() => {
    const funcionario = db
      .prepare("SELECT id_farmacia FROM funcionario WHERE id_funcionario = ?")
      .get(data.idFuncionario);
    if (!funcionario) throw erro(404, "Funcionário não encontrado.");
    if (
      !db
        .prepare("SELECT 1 FROM farmacia WHERE id_farmacia = ?")
        .get(data.idFarmacia)
    ) {
      throw erro(404, "Farmácia não encontrada.");
    }
    if (funcionario.id_farmacia !== data.idFarmacia) {
      throw erro(400, "O funcionário não pertence à farmácia informada.");
    }
    if (
      !db
        .prepare("SELECT 1 FROM paciente WHERE id_paciente = ?")
        .get(data.idPaciente)
    ) {
      throw erro(404, "Paciente não encontrado.");
    }

    const result = db
      .prepare(
        /*sql*/ `
      INSERT INTO servico (id_funcionario, id_paciente, id_farmacia, observacao)
      VALUES (?, ?, ?, ?)
    `
      )
      .run(
        data.idFuncionario,
        data.idPaciente,
        data.idFarmacia,
        textoOuNull(data.observacao)
      );
    const idServico = Number(result.lastInsertRowid);
    const buscarRemedio = db.prepare(
      "SELECT 1 FROM remedio WHERE id_remedio = ?"
    );
    const inserirItem = db.prepare(/*sql*/ `
      INSERT INTO servico_remedio (id_servico, id_remedio, quantidade) VALUES (?, ?, ?)
    `);
    for (const item of data.remedios) {
      if (!buscarRemedio.get(item.idRemedio)) {
        throw erro(404, `Remédio ${item.idRemedio} não encontrado.`);
      }
      inserirItem.run(idServico, item.idRemedio, item.quantidade);
    }
    // dá baixa no estoque da farmácia (se faltar algo, a transação desfaz tudo)
    const baixas = baixarEstoque(data.idFarmacia, data.remedios);
    return { idServico, baixas };
  });
}

// idFarmacia opcional: só os serviços daquela farmácia
export function listarServicos(idFarmacia = null) {
  return db.prepare(/*sql*/ `
    SELECT s.id_servico AS idServico, s.data_servico AS dataServico,
           s.observacao, p.nome AS nomePaciente, p.id_paciente AS idPaciente,
           f.nome AS nomeFuncionario, fa.nome AS nomeFarmacia,
           s.id_farmacia AS idFarmacia,
           COUNT(sr.id_remedio) AS totalMedicamentos,
           COALESCE(SUM(sr.quantidade), 0) AS quantidadeTotal
    FROM servico s
    JOIN paciente p ON p.id_paciente = s.id_paciente
    JOIN funcionario f ON f.id_funcionario = s.id_funcionario
    JOIN farmacia fa ON fa.id_farmacia = s.id_farmacia
    LEFT JOIN servico_remedio sr ON sr.id_servico = s.id_servico
    WHERE (? IS NULL OR s.id_farmacia = ?)
    GROUP BY s.id_servico
    ORDER BY s.data_servico DESC, s.id_servico DESC
  `).all(idFarmacia, idFarmacia);
}

// detalhe do serviço: paciente, funcionário, farmácia e os remédios entregues
export function buscarServico(idServico) {
  const servico = db.prepare(/*sql*/ `
    SELECT s.id_servico AS idServico, s.data_servico AS dataServico, s.observacao,
           p.id_paciente AS idPaciente, p.nome AS nomePaciente, p.cpf AS cpfPaciente,
           p.email AS emailPaciente, p.telefone AS telPaciente,
           p.medicamento_frequente AS medicamentoFrequentePaciente,
           f.id_funcionario AS idFuncionario, f.nome AS nomeFuncionario, f.cpf AS cpfFuncionario,
           f.email AS emailFuncionario, f.telefone AS telFuncionario, f.matricula AS matriculaFuncionario,
           f.cargo AS cargoFuncionario, f.turno AS turnoFuncionario,
           fa.id_farmacia AS idFarmacia, fa.nome AS nomeFarmacia, fa.cnes AS cnesFarmacia,
           fa.email AS emailFarmacia, fa.telefone AS telFarmacia
    FROM servico s
    JOIN paciente p ON p.id_paciente = s.id_paciente
    JOIN funcionario f ON f.id_funcionario = s.id_funcionario
    JOIN farmacia fa ON fa.id_farmacia = s.id_farmacia
    WHERE s.id_servico = ?
  `).get(idServico);
  if (!servico) return null;

  const remedios = db.prepare(/*sql*/ `
    SELECT r.id_remedio AS idRemedio, r.nome AS nomeRemedio, r.dosagem AS dosagemRemedio,
           r.descricao AS descRemedio, r.fabricante AS fabricanteRemedio,
           r.tarja AS tarjaRemedio, r.foto AS fotoRemedio, sr.quantidade,
           (SELECT group_concat(c.nome, ', ') FROM remedio_categoria rc
              JOIN categoria c ON c.id_categoria = rc.id_categoria
             WHERE rc.id_remedio = r.id_remedio) AS categorias
    FROM servico_remedio sr
    JOIN remedio r ON r.id_remedio = sr.id_remedio
    WHERE sr.id_servico = ?
    ORDER BY r.nome
  `).all(idServico).map((item) => ({ ...item, categorias: item.categorias ?? "" }));

  return {
    ...servico,
    totalMedicamentos: remedios.length,
    quantidadeTotal: remedios.reduce((total, item) => total + item.quantidade, 0),
    remedios,
  };
}
