import { fileURLToPath } from "node:url";
import * as serviceAnalytics from "../services/analytics.service.mjs";
import { lerFiltros } from "../utils/periodo-desempenho.mjs";
import { enviarErro, enviarJson, erro, lerJson } from "../utils/http.mjs";
import { enviarFoto, removerFoto, salvarFoto } from "../utils/foto.mjs";

// Capturas das telas do app, fundo do mapa de calor do app (padrão: uploads/telas)
export const PASTA_TELAS = process.env.INTERMEDI_UPLOAD_TELAS_DIR ||
  fileURLToPath(new URL("../uploads/telas/", import.meta.url));

const urlDe = (req) => new URL(req.url, "http://localhost");

// lote de cliques e visitas (web e app); público, mas nunca grava texto digitado
export async function receberCliques(req, res) {
  try {
    // o navegador manda com sendBeacon (Content-Type text/plain): lerJson aceita
    const dados = await lerJson(req, 512 * 1024);
    enviarJson(res, 201, serviceAnalytics.registrarLote(dados));
  } catch (error) {
    enviarErro(res, error);
  }
}

export async function pontosDoMapa(req, res) {
  try {
    const url = urlDe(req);
    const filtros = lerFiltros(url);
    // ?plataforma da rota tem prioridade sobre o filtro global
    enviarJson(res, 200, serviceAnalytics.pontosDoMapa(filtros, {
      rota: url.searchParams.get("rota"),
      persona: url.searchParams.get("persona") || undefined,
      dispositivo: url.searchParams.get("dispositivo") || undefined,
    }));
  } catch (error) {
    enviarErro(res, error);
  }
}

export async function rankingRotas(req, res) {
  try {
    enviarJson(res, 200, { rotas: serviceAnalytics.rankingRotas(lerFiltros(urlDe(req))) });
  } catch (error) {
    enviarErro(res, error);
  }
}

export async function resumoGeral(req, res) {
  try {
    enviarJson(res, 200, serviceAnalytics.resumoGeral(lerFiltros(urlDe(req))));
  } catch (error) {
    enviarErro(res, error);
  }
}

export async function listarCapturas(req, res) {
  try {
    enviarJson(res, 200, { capturas: serviceAnalytics.listarCapturas() });
  } catch (error) {
    enviarErro(res, error);
  }
}

// multipart/form-data, campo "foto"; ?rota=/pesquisa&largura=390&altura=844
// Em produção só o admin envia; em desenvolvimento o app manda sozinho.
export async function enviarCaptura(req, res) {
  let arquivo = null;
  try {
    if (process.env.NODE_ENV === "production" && req.usuario?.papel !== "admin") {
      throw erro(403, "Só o admin envia as capturas das telas.");
    }
    const url = urlDe(req);
    if (!serviceAnalytics.normalizarRota(url.searchParams.get("rota"))) {
      throw erro(400, "Informe a rota da tela (ex.: ?rota=/pesquisa).");
    }
    arquivo = await salvarFoto(req, PASTA_TELAS);
    const salva = serviceAnalytics.salvarCaptura({
      rota: url.searchParams.get("rota"),
      arquivo,
      largura: url.searchParams.get("largura"),
      altura: url.searchParams.get("altura"),
    });
    await removerFoto(PASTA_TELAS, salva.antiga);
    enviarJson(res, 201, { rota: salva.rota, url: salva.url });
  } catch (error) {
    if (arquivo) await removerFoto(PASTA_TELAS, arquivo);
    enviarErro(res, error);
  }
}

export async function exibirCaptura(req, res) {
  try {
    await enviarFoto(res, PASTA_TELAS, req.params.arquivo);
  } catch (error) {
    enviarErro(res, error);
  }
}
