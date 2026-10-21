import { tmpdir } from "node:os";
import path from "node:path";
import { buscarRemediosNaFoto } from "./busca-foto.service.mjs";
import { salvarFoto, removerFoto } from "../utils/foto.mjs";
import { enviarErro, enviarJson, erro } from "../utils/http.mjs";

// Reutiliza o upload validado do projeto (JPEG, PNG ou WebP, até 5 MB).
export function criarReconhecedorFoto({
  buscar = buscarRemediosNaFoto,
  pasta = path.join(tmpdir(), "intermedi-ocr"),
} = {}) {
  let processando = false;
  return async function reconhecerFoto(req, res) {
    if (processando) {
      req.resume();
      res.setHeader("Retry-After", "5");
      enviarErro(res, erro(429, "Já estamos lendo uma foto. Aguarde e tente novamente."));
      return;
    }
    processando = true;
    let arquivo;
    try {
      arquivo = await salvarFoto(req, pasta);
      const resultado = await buscar(path.join(pasta, arquivo));
      enviarJson(res, 200, resultado);
    } catch (error) {
      enviarErro(res, error);
    } finally {
      await removerFoto(pasta, arquivo);
      processando = false;
    }
  };
}

export const reconhecerFotoRemedio = criarReconhecedorFoto();
