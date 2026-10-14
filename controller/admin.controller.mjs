import * as adminService from "../services/admin.service.mjs";
import { enviarErro, enviarJson, lerJson } from "../utils/http.mjs";

export async function loginAdmin(req, res) {
  try {
    const data = await lerJson(req);
    const resultado = await adminService.autenticar(data);
    enviarJson(res, 200, resultado);
  } catch (error) {
    enviarErro(res, error);
  }
}

export async function listarGerentes(req, res) {
  try {
    const gerentes = adminService.listarGerentesAdmin();
    enviarJson(res, 200, gerentes);
  } catch (error) {
    enviarErro(res, error);
  }
}

export async function cadastrarGerente(req, res) {
  try {
    const data = await lerJson(req);
    const resultado = await adminService.cadastrarGerenteAdmin(data);
    enviarJson(res, 201, resultado);
  } catch (error) {
    enviarErro(res, error);
  }
}

export async function listarPacientes(req, res) {
  try {
    const pacientes = adminService.listarPacientesAdmin();
    enviarJson(res, 200, pacientes);
  } catch (error) {
    enviarErro(res, error);
  }
}

export async function pesquisarPacientes(req, res) {
  try {
    // Extrai o parâmetro "termo" de forma segura usando a URL da requisição
    const baseUrl = `http://${req.headers.host || "localhost"}`;
    const parsedUrl = new URL(req.url, baseUrl);
    const termo = parsedUrl.searchParams.get("termo") || "";

    const pacientes = adminService.pesquisarPacientesAdmin(termo);
    enviarJson(res, 200, pacientes);
  } catch (error) {
    enviarErro(res, error);
  }
}