import db from "../database/database.mjs";
import { erro } from "../utils/http.mjs";
import { texto } from "../utils/dados.mjs";
import { verificarSenha } from "../utils/senha.mjs";

const SELECT_ADMIN = `
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

  // Remove o hash da senha antes de retornar os dados da sessão
  delete admin.senhaHash;

  return {
    mensagem: "Login realizado com sucesso.",
    admin,
    token: `sessao-admin-${admin.idAdmin}`
  };
}