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