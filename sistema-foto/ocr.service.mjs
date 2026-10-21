import { createWorker, PSM } from "tesseract.js";
import { erro } from "../utils/http.mjs";
import sharp from "sharp";

export async function lerTextoDaFoto(caminhoDaImagem) {
  const worker = await createWorker("por");

  try {
    // Embalagens têm títulos, dosagens e rótulos separados, não um bloco único.
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    // Aplica a orientação EXIF e gera rotações sem cortar a imagem.
    const imagem = await sharp(caminhoDaImagem, { limitInputPixels: 40000000 })
      .autoOrient().resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
      .grayscale().normalize().png().toBuffer();
    let melhorLeitura;
    for (const angulo of [0, 90, 180, 270]) {
      const orientada = await sharp(imagem).rotate(angulo).png().toBuffer();
      const { data } = await worker.recognize(orientada);
      if (data.text.trim() && Number.isFinite(data.confidence) &&
          (!melhorLeitura || data.confidence > melhorLeitura.confidence)) {
        melhorLeitura = data;
      }
    }

    const texto = melhorLeitura?.text.trim();
    if (!texto || melhorLeitura.confidence < 30) {
      throw erro(422, "Não conseguimos ler o texto da embalagem com clareza. Tente recortar a região do nome ou use a busca digitada.");
    }

    return texto;
  } finally {
    await worker.terminate();
  }
}
