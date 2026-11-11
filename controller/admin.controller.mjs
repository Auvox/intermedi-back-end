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
    const baseUrl = `http://${req.headers.host || "localhost"}`;
    const parsedUrl = new URL(req.url, baseUrl);
    const termo = parsedUrl.searchParams.get("termo") || "";

    const pacientes = adminService.pesquisarPacientesAdmin(termo);
    enviarJson(res, 200, pacientes);
  } catch (error) {
    enviarErro(res, error);
  }
}

export async function receberChamadoExterno(req, res) {
  try {
    const data = await lerJson(req);
    const resultado = await adminService.receberChamadoExternoAdmin(data);
    enviarJson(res, 201, resultado);
  } catch (error) {
    enviarErro(res, error);
  }
}

export async function desativarFarmacia(req, res) {
  try {
    const idFarmacia = req.params?.id || req.pathParams?.id; 
    const resultado = adminService.desativarFarmaciaAdmin(idFarmacia);
    enviarJson(res, 200, resultado);
  } catch (error) {
    enviarErro(res, error);
  }
}

export async function listarHistoricoChamados(req, res) {
  try {
    const historico = adminService.listarHistoricoChamadosAdmin();
    enviarJson(res, 200, historico);
  } catch (error) {
    enviarErro(res, error);
  }
}

export async function listarHistoricoChamadosInternos(req, res) {
  try {
    const historicoInterno = adminService.listarHistoricoChamadosInternosAdmin();
    enviarJson(res, 200, historicoInterno);
  } catch (error) {
    enviarErro(res, error);
  }
}

export async function editarRemedio(req, res) {
  try {
    const idRemedio = req.params?.id || req.pathParams?.id;
    const data = await lerJson(req);
    const resultado = adminService.editarRemedioAdmin(idRemedio, data);
    enviarJson(res, 200, resultado);
  } catch (error) {
    enviarErro(res, error);
  }
}