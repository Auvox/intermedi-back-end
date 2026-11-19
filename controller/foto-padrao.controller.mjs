import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { enviarErro, erro } from "../utils/http.mjs";

// Fotos que vêm com o projeto (database/fotos-padrao, versionadas no git):
// fotos reais dos remédios, fachadas das farmácias e retratos da equipe de
// demonstração. Ficam fora de uploads/ (ignorado pelo git) para aparecerem em
// qualquer máquina depois do pull. Trocar a foto pelo site grava em uploads/
// e não apaga estes arquivos.
const PASTA = fileURLToPath(new URL("../database/fotos-padrao/", import.meta.url));
const NOME_VALIDO = /^[a-z0-9-]+\.(webp|jpg|png)$/;
const MIME = { webp: "image/webp", jpg: "image/jpeg", png: "image/png" };

export async function exibirFotoPadrao(req, res) {
  try {
    const nome = req.params.arquivo ?? "";
    if (!NOME_VALIDO.test(nome)) throw erro(404, "Foto não encontrada.");
    let bytes;
    try {
      bytes = await readFile(path.join(PASTA, nome));
    } catch (error) {
      if (error.code === "ENOENT") throw erro(404, "Foto não encontrada.");
      throw error;
    }
    res.writeHead(200, {
      "Content-Type": MIME[nome.split(".").pop()],
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=86400",
    });
    res.end(bytes);
  } catch (error) {
    enviarErro(res, error);
  }
}
