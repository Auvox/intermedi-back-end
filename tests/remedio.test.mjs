import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// Banco temporário com os dados do seed (nunca mexe no banco local)
const temp = await mkdtemp(path.join(tmpdir(), "intermedi-remedio-"));
process.env.INTERMEDI_DB_PATH = path.join(temp, "test.db");

const { default: db } = await import("../database/database.mjs");
const { aplicarSeed } = await import("../database/setup.mjs");
const serviceRemedio = await import("../services/remedio.service.mjs");
aplicarSeed(db);

test.after(async () => {
  db.close();
  await rm(temp, { recursive: true, force: true });
});

let sequencia = 0;
const payload = (extra = {}) => ({
  nomeRemedio: "Novalgina",
  principioAtivoRemedio: "dipirona monoidratada",
  descRemedio: "Analgésico",
  dosagemRemedio: "1g",
  fabricanteRemedio: "Laboratório Teste",
  registroAnvisaRemedio: `9${String(++sequencia).padStart(12, "0")}`,
  tipoRemedio: "referencia",
  tarjaRemedio: "sem_tarja",
  formaFarmaceuticaRemedio: "comprimido",
  viaAdministracaoRemedio: "oral",
  apresentacaoRemedio: "Caixa com 10 comprimidos",
  idsCategoria: [1, 2],
  ...extra,
});

test("cadastrar grava todos os campos, formata o registro e devolve o remédio completo", () => {
  const remedio = serviceRemedio.cadastrar(payload({ tarjaRemedio: "vermelha_retencao" }));

  assert.equal(remedio.nomeRemedio, "Novalgina");
  assert.match(remedio.registroAnvisaRemedio, /^\d\.\d{4}\.\d{4}\.\d{3}-\d$/);
  assert.equal(remedio.exigeReceita, true);
  assert.equal(remedio.retemReceita, true);
  assert.deepEqual(remedio.idsCategoria, [1, 2]);
  assert.equal(remedio.fotoRemedio, null);
});

test("cadastro sem campos legais, com opção inválida ou registro duplicado é recusado", () => {
  assert.throws(() => serviceRemedio.cadastrar({ nomeRemedio: "Só nome" }), { status: 400 });
  assert.throws(() => serviceRemedio.cadastrar(payload({ registroAnvisaRemedio: "123" })), { status: 400 });
  assert.throws(() => serviceRemedio.cadastrar(payload({ tipoRemedio: "manipulado" })), { status: 400 });
  assert.throws(() => serviceRemedio.cadastrar(payload({ tarjaRemedio: "azul" })), { status: 400 });
  assert.throws(() => serviceRemedio.cadastrar(payload({ idsCategoria: [999] })), { status: 400 });
  // registro da Dipirona do seed
  assert.throws(() => serviceRemedio.cadastrar(payload({ registroAnvisaRemedio: "1000100010011" })), { status: 409 });
});

test("listar filtra por busca (nome/princípio ativo) e por categoria", () => {
  const porPrincipio = serviceRemedio.listar({ busca: "AMOXICILINA TRI" });
  assert.deepEqual(porPrincipio.map((r) => r.nomeRemedio), ["Amoxicilina"]);

  const antibioticos = serviceRemedio.listar({ categoria: "antibi" }).map((r) => r.nomeRemedio);
  assert.deepEqual(antibioticos, ["Amoxicilina", "Azitromicina"]);

  assert.ok(serviceRemedio.listar().length >= 15);
});

test("editar muda só o que foi enviado e registra updated_at", () => {
  const { idRemedio } = serviceRemedio.cadastrar(payload());
  const editado = serviceRemedio.editar(idRemedio, { dosagemRemedio: "500mg", idsCategoria: [3] });

  assert.equal(editado.dosagemRemedio, "500mg");
  assert.equal(editado.nomeRemedio, "Novalgina");
  assert.deepEqual(editado.idsCategoria, [3]);
  assert.ok(editado.updatedAtRemedio);
  assert.equal(serviceRemedio.editar(999999, {}), null);
});

test("deletar apaga remédio sem histórico e bloqueia remédio em uso", () => {
  const { idRemedio } = serviceRemedio.cadastrar(payload());
  assert.equal(serviceRemedio.deletar(idRemedio).idRemedio, idRemedio);
  assert.equal(serviceRemedio.buscarPorId(idRemedio), undefined);

  // Dipirona (1) tem estoque, chamado e serviço no seed
  assert.throws(() => serviceRemedio.deletar(1), { status: 409 });
  assert.equal(serviceRemedio.deletar(999999), null);
});
