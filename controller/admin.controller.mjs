import * as adminService from "../services/admin.service.mjs";
import { enviarErro, enviarJson, lerJson } from "../utils/http.mjs"; // Ajustado para importar de utils/http.mjs

export async function loginAdmin(req, res) {
  try {
    const data = await lerJson(req);
    const resultado = await adminService.autenticar(data);
    enviarJson(res, 200, resultado);
  } catch (error) {
    enviarErro(res, error);
  }
}