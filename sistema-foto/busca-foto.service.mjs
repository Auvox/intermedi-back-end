import { lerTextoDaFoto } from "./ocr.service.mjs";
import { listar } from "../services/remedio.service.mjs";

function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export async function buscarRemediosNaFoto(caminhoDaImagem) {
  const textoReconhecido = await lerTextoDaFoto(caminhoDaImagem);
  const textoNormalizado = ` ${normalizar(textoReconhecido)} `;

  const medicamentos = listar().filter((remedio) => {
    const nome = normalizar(remedio.nomeRemedio);

    return nome.length > 0 &&
      textoNormalizado.includes(` ${nome} `);
  });

  return {
    textoReconhecido,
    medicamentos,
  };
}
