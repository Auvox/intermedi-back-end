import { readFile } from "node:fs/promises";

// Logos do e-mail de boas-vindas: os PNGs reais da Intermedi e da Auvox
// (recortados de src/assets/logoIntermedi.png do front e do logo da Auvox),
// guardados em ./marcas com 3x o tamanho de exibição para telas retina.
// Vão anexados ao e-mail e o HTML usa <img src="cid:nome">. No modo de teste
// (sem SMTP), email.service troca o cid: pela própria imagem em base64 para o
// .html salvo abrir completo.

// largura × altura de exibição no e-mail (px)
export const MARCAS = {
  "marca-intermedi": { arquivo: "intermedi.png", largura: 168, altura: 106 },
  "marca-auvox": { arquivo: "auvox.png", largura: 156, altura: 41 },
};

const pasta = new URL("./marcas/", import.meta.url);
const cache = new Map();

// nomes: os que o HTML usa (ex.: ["marca-intermedi", "marca-auvox"])
export async function imagensDoEmail(nomes) {
  const anexos = [];
  for (const nome of new Set(nomes)) {
    const marca = MARCAS[nome];
    if (!marca) continue;
    if (!cache.has(nome)) cache.set(nome, await readFile(new URL(marca.arquivo, pasta)));
    anexos.push({ cid: nome, filename: marca.arquivo, content: cache.get(nome), contentType: "image/png" });
  }
  return anexos;
}
