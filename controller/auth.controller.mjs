import * as serviceAuth from "../services/auth.service.mjs";
import { sessaoOpcional } from "../services/acesso.service.mjs";
import { enviarErro, enviarJson, lerJson } from "../utils/http.mjs";

// login da equipe: { cpf ou email, matricula, senha } -> { token, expiraEm, usuario }
export async function entrar(req, res) {
  try {
    const data = await lerJson(req, 16 * 1024);
    const sessao = serviceAuth.entrar(data, req.socket.remoteAddress ?? "");
    res.setHeader("Cache-Control", "no-store");
    enviarJson(res, 200, sessao);
  } catch (error) {
    enviarErro(res, error);
  }
}

// quem está logado (o server.mjs já conferiu o token)
export function quemSouEu(req, res) {
  res.setHeader("Cache-Control", "no-store");
  enviarJson(res, 200, { usuario: req.usuario });
}

// encerra a sessão do token; responde 200 mesmo se o token já não valia
export function sair(req, res) {
  try {
    const sessao = sessaoOpcional(req);
    if (sessao) serviceAuth.encerrarSessao(sessao.jti);
    enviarJson(res, 200, { mensagem: "Sessão encerrada." });
  } catch (error) {
    enviarErro(res, error);
  }
}
