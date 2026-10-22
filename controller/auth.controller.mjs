import * as serviceAuth from "../services/auth.service.mjs";
import { sessaoOpcional } from "../services/acesso.service.mjs";
import { enviarErro, enviarJson, lerJson } from "../utils/http.mjs";

// login da equipe: { cpf, matricula, senha } -> { token, expiraEm, usuario }
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

// sinal de "ainda estou aqui" (o front manda a cada minuto); conta o tempo logado
export function presenca(req, res) {
  try {
    const sessao = sessaoOpcional(req);
    if (!sessao) return enviarJson(res, 401, { error: "Sessão encerrada. Faça login de novo." });
    serviceAuth.registrarPresenca(sessao.jti);
    res.setHeader("Cache-Control", "no-store");
    enviarJson(res, 200, { ok: true });
  } catch (error) {
    enviarErro(res, error);
  }
}

// tempo logado: GET /funcionario/:id/acessos e /gerente/:id/acessos (?dias=7)
const acessosDe = (papel) => (req, res) => {
  try {
    const dias = new URL(req.url, "http://localhost").searchParams.get("dias") ?? 7;
    res.setHeader("Cache-Control", "no-store");
    enviarJson(res, 200, serviceAuth.listarAcessos(papel, req.params?.id, { dias }));
  } catch (error) {
    enviarErro(res, error);
  }
};
export const acessosDoFuncionario = acessosDe("funcionario");
export const acessosDoGerente = acessosDe("gerente");
