import * as serviceAlerta from "../services/alerta.service.mjs";
import * as serviceSaude from "../services/saude.service.mjs";
import { lerFiltros } from "../utils/periodo-desempenho.mjs";
import { enviarErro, enviarJson, erro, lerJson } from "../utils/http.mjs";

const urlDe = (req) => new URL(req.url, "http://localhost");

export async function painelSaude(req, res) {
  let filtros;
  try {
    filtros = lerFiltros(urlDe(req));
    enviarJson(res, 200, serviceSaude.painelSaude(filtros));
  } catch (error) {
    if (error.status) return enviarErro(res, error);
    // banco fora do ar: responde o que dá para saber sem ele
    const { alertas } = serviceAlerta.listarAlertas({ status: "ativo" });
    enviarJson(res, 200, {
      status: { ok: false, problemas: Math.max(1, alertas.length), criticos: 1, frase: "O banco de dados não está respondendo" },
      banco: { ok: false, mensagem: error.message },
      indisponivel: true,
      passo: filtros?.passo ?? 3600000,
      tempoResposta: [],
      rotasComErro: [],
      ultimosErros: [],
      totais: null,
    });
  }
}

export async function listarAlertas(req, res) {
  try {
    const status = urlDe(req).searchParams.get("status") || "ativo";
    enviarJson(res, 200, serviceAlerta.listarAlertas({ status }));
  } catch (error) {
    enviarErro(res, error);
  }
}

// o id pode ser "memoria:<chave>" (alerta que ainda não foi gravado no banco)
const idDoAlerta = (req) => {
  const id = decodeURIComponent(req.params.id ?? "");
  if (!id || (!/^\d+$/.test(id) && !id.startsWith("memoria:"))) throw erro(404, "Alerta não encontrado.");
  return id;
};

export async function resolverAlerta(req, res) {
  try {
    enviarJson(res, 200, { alerta: serviceAlerta.resolverAlerta(idDoAlerta(req)) });
  } catch (error) {
    enviarErro(res, error);
  }
}

// corpo opcional { minutos } (padrão: 60)
export async function silenciarAlerta(req, res) {
  try {
    const id = idDoAlerta(req);
    const corpo = req.headers["content-length"] > 0 ? await lerJson(req) : {};
    enviarJson(res, 200, { alerta: serviceAlerta.silenciarAlerta(id, Number(corpo.minutos ?? 60)) });
  } catch (error) {
    enviarErro(res, error);
  }
}
