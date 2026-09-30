import * as serviceCategoria from "../services/categoria.service.mjs";
import { enviarErro, enviarJson } from "../utils/http.mjs";

// listar categorias
export async function consultarCategorias(req, res) {
  try {
    const categorias = serviceCategoria.listar();
    enviarJson(res, 200, {
      mensagem: "TODAS AS CATEGORIAS CADASTRADAS - GET",
      categorias,
    });
  } catch (error) {
    enviarErro(res, error);
  }
}
