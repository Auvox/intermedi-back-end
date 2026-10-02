import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readdir, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

process.env.INTERMEDI_DB_PATH = ":memory:";
const { criarReconhecedorFoto } = await import("../sistema-foto/ocr.controller.mjs");
const { default: db } = await import("../database/database.mjs");

test("upload OCR devolve resultados, valida a foto e remove arquivos mesmo em falha", async () => {
  const pasta = await mkdtemp(path.join(tmpdir(), "intermedi-ocr-teste-"));
  let falhar = false;
  const handler = criarReconhecedorFoto({ pasta, buscar: async (arquivo) => {
    assert.ok((await readFile(arquivo)).length > 0);
    if (falhar) throw Object.assign(new Error("OCR indisponível"), { status: 503 });
    return { textoReconhecido: "Dipirona", medicamentos: [{ idRemedio: 1, nomeRemedio: "Dipirona" }] };
  } });
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}/remedios/reconhecer-foto`;
  const enviar = (bytes, tipo) => {
    const form = new FormData();
    form.append("foto", new Blob([bytes], { type: tipo }), "foto.png");
    return fetch(url, { method: "POST", body: form });
  };
  try {
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
    let resposta = await enviar(png, "image/png");
    assert.equal(resposta.status, 200);
    assert.equal((await resposta.json()).medicamentos[0].nomeRemedio, "Dipirona");
    // O finally pode terminar após a resposta chegar ao cliente.
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(await readdir(pasta), []);
    resposta = await enviar("arquivo inválido", "image/png");
    assert.equal(resposta.status, 400);
    await resposta.text();
    await new Promise(resolve => setImmediate(resolve));
    falhar = true;
    resposta = await enviar(png, "image/png");
    assert.equal(resposta.status, 503);
    await resposta.text();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(await readdir(pasta), []);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(pasta, { recursive: true, force: true });
    db.close();
  }
});
