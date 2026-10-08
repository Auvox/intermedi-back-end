// Upload de fotos (multipart/form-data, campo "foto").
// Mesmas regras da foto de perfil do paciente: JPEG, PNG ou WebP, até 5 MB,
// tipo conferido pelos bytes do arquivo (não pela extensão enviada).
import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { erro } from "./http.mjs";

const LIMITE = 5 * 1024 * 1024;
const MIME = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
const NOME_VALIDO = /^[a-f0-9]{48}\.(jpg|png|webp)$/;

function extensao(buffer) {
  if (buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return "jpg";
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

// Lê a foto da requisição e salva em "pasta". Retorna o nome do arquivo.
export async function salvarFoto(req, pasta) {
  const partes = [];
  let tamanho = 0;
  for await (const parte of req) {
    tamanho += parte.length;
    if (tamanho > LIMITE + 65536) throw erro(413, "A foto deve ter no máximo 5 MB.");
    partes.push(parte);
  }

  let form;
  try {
    form = await new Request("http://localhost/upload", {
      method: "POST",
      headers: { "Content-Type": req.headers["content-type"] || "" },
      body: Buffer.concat(partes),
    }).formData();
  } catch {
    throw erro(400, "Envie a foto como multipart/form-data no campo \"foto\".");
  }

  const arquivo = form.get("foto");
  if (!arquivo || typeof arquivo === "string" || !arquivo.size) throw erro(400, "Selecione uma foto.");
  if (arquivo.size > LIMITE) throw erro(413, "A foto deve ter no máximo 5 MB.");

  const buffer = Buffer.from(await arquivo.arrayBuffer());
  const ext = extensao(buffer);
  if (!ext) throw erro(400, "Use uma imagem JPEG, PNG ou WebP.");

  const nome = `${randomBytes(24).toString("hex")}.${ext}`;
  await mkdir(pasta, { recursive: true });
  await writeFile(path.join(pasta, nome), buffer, { flag: "wx" });
  return nome;
}

// Apaga o arquivo (ignora se já não existir)
export async function removerFoto(pasta, nome) {
  if (nome && NOME_VALIDO.test(nome)) await unlink(path.join(pasta, nome)).catch(() => {});
}

// Devolve a imagem para o navegador
export async function enviarFoto(res, pasta, nome) {
  if (!NOME_VALIDO.test(nome ?? "")) throw erro(404, "Foto não encontrada.");
  let bytes;
  try {
    bytes = await readFile(path.join(pasta, nome));
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
}
