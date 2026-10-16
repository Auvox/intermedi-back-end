import db from "../database/database.mjs";
import { erro } from "../utils/http.mjs";
import { texto } from "../utils/dados.mjs";
import { verificarSenha, gerarSenhaProvisoria } from "../utils/senha.mjs";

const SELECT_ADMIN = /*sql*/ `
  SELECT
      id_admin AS idAdmin,
      nome AS nome,
      email AS email,
      senha_hash AS senhaHash
  FROM admin
`;

// Autenticar administrador
export function autenticar(data) {
  const email = texto(data.email);
  const senha = texto(data.senha);

  if (!email || !senha) {
    throw erro(400, "Informe o e-mail e a senha.");
  }

  const admin = db.prepare(`${SELECT_ADMIN} WHERE email = ?`).get(email);

  if (!admin || !verificarSenha(senha, admin.senhaHash)) {
    throw erro(401, "E-mail ou senha inválidos.");
  }

  delete admin.senhaHash;

  return {
    mensagem: "Login realizado com sucesso.",
    admin,
    token: `sessao-admin-${admin.idAdmin}`
  };
}

// Listar gerentes para o admin
export function listarGerentesAdmin() {
  const gerentes = db.prepare(`
    SELECT id_gerente AS idGerente, nome, email, cpf, crf, matricula, telefone 
    FROM gerente
  `).all();
  
  return gerentes;
}

// Cadastrar gerente pelo admin
export function cadastrarGerenteAdmin(data) {
  const nome = texto(data?.nome);
  const cpf = texto(data?.cpf);
  const email = texto(data?.email);
  const senha = texto(data?.senha);
  const crf = texto(data?.crf);
  const matricula = texto(data?.matricula);
  const telefone = texto(data?.telefone) || null;
  const idFarmacia = data?.idFarmacia ? Number(data.idFarmacia) : null;
  const idAdminCadastro = data?.idAdminCadastro ? Number(data.idAdminCadastro) : 1;
  const idEndereco = data?.idEndereco ? Number(data.idEndereco) : null;

  if (!nome || !cpf || !email || !senha || !crf || !matricula || !idFarmacia) {
    throw erro(400, "Preencha todos os campos obrigatórios (nome, cpf, email, senha, crf, matricula e idFarmacia).");
  }

  if (!email.includes("@") || !email.includes(".")) {
    throw erro(400, "Informe um e-mail válido.");
  }

  const existente = db.prepare(`SELECT id_gerente FROM gerente WHERE email = ?`).get(email);
  if (existente) {
    throw erro(400, "Este e-mail já está cadastrado para outro gerente.");
  }

  const senhaHash = gerarSenhaProvisoria(senha);

  const resultado = db.prepare(`
    INSERT INTO gerente (nome, cpf, email, senha_hash, crf, matricula, telefone, id_farmacia, id_admin_cadastro, id_endereco)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(nome, cpf, email, senhaHash, crf, matricula, telefone, idFarmacia, idAdminCadastro, idEndereco);

  return {
    mensagem: "Gerente cadastrado com sucesso pelo admin.",
    idGerente: resultado.lastInsertRowid
  };
}

// Listar todos os pacientes para o admin
export function listarPacientesAdmin() {
  const pacientes = db.prepare(`
    SELECT 
        id_paciente AS idPaciente, 
        nome, 
        cpf, 
        email, 
        telefone, 
        medicamento_frequente AS medicamentoFrequente, 
        id_endereco AS idEndereco
    FROM paciente
  `).all();

  return pacientes;
}

// Pesquisar pacientes por termo (autocomplete por nome ou cpf)
export function pesquisarPacientesAdmin(termoBusca) {
  const termo = texto(termoBusca);

  if (!termo) {
    return listarPacientesAdmin();
  }

  const query = `
    SELECT 
        id_paciente AS idPaciente, 
        nome, 
        cpf, 
        email, 
        telefone, 
        medicamento_frequente AS medicamentoFrequente, 
        id_endereco AS idEndereco
    FROM paciente
    WHERE nome LIKE ? OR cpf LIKE ?
  `;

  const padraoBusca = `%${termo}%`;
  const pacientes = db.prepare(query).all(padraoBusca, padraoBusca);

  return pacientes;
}

// Receber e armazenar chamado externo
export function receberChamadoExternoAdmin(data) {
  const titulo = texto(data?.titulo);
  const descricao = texto(data?.descricao);
  const prioridade = texto(data?.prioridade) || "media";
  const idFuncionario = data?.idFuncionario ? Number(data.idFuncionario) : null;
  const idFarmacia = data?.idFarmacia ? Number(data.idFarmacia) : null;

  if (!titulo || !descricao || !idFuncionario || !idFarmacia) {
    throw erro(400, "Preencha os campos obrigatórios do chamado (titulo, descricao, idFuncionario, idFarmacia).");
  }

  const status = "pendente";
  const dataAbertura = new Date().toISOString().slice(0, 19).replace('T', ' ');

  const resultado = db.prepare(`
    INSERT INTO chamado (titulo, descricao, status, prioridade, data_abertura, id_funcionario, id_farmacia, id_gerente_resposta, data_resposta, resposta_gerente)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)
  `).run(titulo, descricao, status, prioridade, dataAbertura, idFuncionario, idFarmacia);

  return {
    mensagem: "Chamado externo recebido e armazenado com sucesso.",
    idChamado: resultado.lastInsertRowid
  };
}

// Desativar farmácia com verificação de vínculos
export function desativarFarmaciaAdmin(idFarmaciaParam) {
  const idFarmacia = Number(idFarmaciaParam);

  if (!idFarmacia || isNaN(idFarmacia)) {
    throw erro(400, "ID da farmácia inválido ou não informado.");
  }

  const farmacia = db.prepare(`SELECT id_farmacia AS idFarmacia, nome FROM farmacia WHERE id_farmacia = ?`).get(idFarmacia);
  if (!farmacia) {
    throw erro(404, "Farmácia não encontrada.");
  }

  const gerentesVinculados = db.prepare(`SELECT COUNT(*) as total FROM gerente WHERE id_farmacia = ?`).get(idFarmacia);
  if (gerentesVinculados.total > 0) {
    throw erro(400, `Não é possível desativar a farmácia. Existem ${gerentesVinculados.total} gerente(s) vinculado(s).`);
  }

  const funcionariosVinculados = db.prepare(`SELECT COUNT(*) as total FROM funcionario WHERE id_farmacia = ?`).get(idFarmacia);
  if (funcionariosVinculados.total > 0) {
    throw erro(400, `Não é possível desativar a farmácia. Existem ${funcionariosVinculados.total} funcionário(s) vinculado(s).`);
  }

  const estoquesVinculados = db.prepare(`SELECT COUNT(*) as total FROM estoque WHERE id_farmacia = ?`).get(idFarmacia);
  if (estoquesVinculados.total > 0) {
    throw erro(400, `Não é possível desativar a farmácia. Existem registros de estoque vinculados.`);
  }

  const resultado = db.prepare(`
    UPDATE farmacia 
    SET ativo = 0 
    WHERE id_farmacia = ?
  `).run(idFarmacia);

  return {
    mensagem: `Farmácia '${farmacia.nome}' desativada com sucesso.`,
    idFarmacia
  };
}

// Consultar histórico completo de chamados (externos/geral)
export function listarHistoricoChamadosAdmin() {
  const chamados = db.prepare(`
    SELECT 
        id_chamado AS idChamado,
        titulo,
        descricao,
        status,
        prioridade,
        data_abertura AS dataAbertura,
        id_funcionario AS idFuncionario,
        id_farmacia AS idFarmacia,
        id_gerente_resposta AS idGerenteResposta,
        data_resposta AS dataResposta,
        resposta_gerente AS respostaGerente
    FROM chamado
  `).all();

  return chamados;
}

// Consultar histórico completo de chamados internos (específico para chamados internos)
export function listarHistoricoChamadosInternosAdmin() {
  const chamadosInternos = db.prepare(`
    SELECT 
        id_chamado AS idChamado,
        titulo,
        descricao,
        status,
        prioridade,
        data_abertura AS dataAbertura,
        id_funcionario AS idFuncionario,
        id_farmacia AS idFarmacia,
        id_gerente_resposta AS idGerenteResposta,
        data_resposta AS dataResposta,
        resposta_gerente AS respostaGerente
    FROM chamado
  `).all();

  return chamadosInternos;
}

// Editar remédio
export function editarRemedioAdmin(idRemedioParam, data) {
  const idRemedio = Number(idRemedioParam);

  if (!idRemedio || isNaN(idRemedio)) {
    throw erro(400, "ID do remédio inválido ou não informado.");
  }

  const remedioExistente = db.prepare(`SELECT id_remedio AS idRemedio FROM remedio WHERE id_remedio = ?`).get(idRemedio);
  if (!remedioExistente) {
    throw erro(404, "Remédio não encontrado.");
  }

  const nome = texto(data?.nome);
  const principioAtivo = texto(data?.principioAtivo) || texto(data?.principio_ativo) || null;
  const descricao = texto(data?.descricao) || null;
  const dosagem = texto(data?.dosagem) || null;
  const fabricante = texto(data?.fabricante) || null;
  const registroAnvisa = texto(data?.registroAnvisa) || texto(data?.registro_anvisa) || null;
  const tipo = texto(data?.tipo) || "generico";
  const tarja = texto(data?.tarja);
  const formaFarmaceutica = texto(data?.formaFarmaceutica) || texto(data?.forma_farmaceutica) || null;
  const viaAdministracao = texto(data?.viaAdministracao) || texto(data?.via_administracao) || null;
  const apresentacao = texto(data?.apresentacao) || null;
  const indicacoes = texto(data?.indicacoes) || null;
  const contraindicacoes = texto(data?.contraindicacoes) || null;
  const armazenamento = texto(data?.armazenamento) || null;

  if (!nome) {
    throw erro(400, "Campo obrigatório não informado (nome).");
  }

  if (!tarja) {
    throw erro(400, "Campo obrigatório não informado (tarja).");
  }

  const resultado = db.prepare(`
    UPDATE remedio 
    SET nome = ?, principio_ativo = ?, descricao = ?, dosagem = ?, fabricante = ?, 
        registro_anvisa = ?, tipo = ?, tarja = ?, forma_farmaceutica = ?, 
        via_administracao = ?, apresentacao = ?, indicacoes = ?, contraindicacoes = ?, armazenamento = ?
    WHERE id_remedio = ?
  `).run(
    nome, principioAtivo, descricao, dosagem, fabricante, 
    registroAnvisa, tipo, tarja, formaFarmaceutica, 
    viaAdministracao, apresentacao, indicacoes, contraindicacoes, armazenamento, 
    idRemedio
  );

  return {
    mensagem: "Remédio atualizado com sucesso.",
    idRemedio
  };
}