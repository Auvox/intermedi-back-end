import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// Banco temporário com os dados do seed (nunca mexe no database/intermedi.db)
const temp = await mkdtemp(path.join(tmpdir(), "intermedi-chamado-"));
process.env.INTERMEDI_DB_PATH = path.join(temp, "test.db");

const { default: db } = await import("../database/database.mjs");
const { aplicarSeed } = await import("../database/setup.mjs");
const serviceChamado = await import("../services/chamado.service.mjs");
aplicarSeed(db);

test.after(async () => {
  db.close();
  await rm(temp, { recursive: true, force: true });
});

// Seed: funcionária 6 (Larissa) e gerente 3 (Beatriz) são da farmácia 3;
// gerente 1 (Ana) é da farmácia 1.
const solicitar = () => serviceChamado.solicitar(6, {
  prioridade: "urgente",
  remedios: [{ idRemedio: 5, quantidade: 100 }, { idRemedio: 9, quantidade: 40 }],
});

test("funcionário solicita: chamado nasce pendente com remédios, estoque e gerentes", () => {
  const chamado = solicitar();

  assert.equal(chamado.status, "pendente");
  assert.equal(chamado.titulo, "Reposição: Amoxicilina, Azitromicina");
  assert.equal(chamado.farmacia.idFarmacia, 3);
  assert.equal(chamado.resposta, null);
  assert.deepEqual(chamado.gerentes.map((g) => g.idGerente), [3]);
  assert.deepEqual(
    chamado.remedios.map((r) => [r.idRemedio, r.quantidadeSolicitada, r.estoqueAtual, r.critico]),
    [[5, 100, 8, true], [9, 40, 25, false]],
  );
});

test("solicitação inválida é recusada", () => {
  assert.throws(() => serviceChamado.solicitar(999, { remedios: [{ idRemedio: 5, quantidade: 1 }] }), { status: 404 });
  assert.throws(() => serviceChamado.solicitar(6, { remedios: [] }), { status: 400 });
  assert.throws(() => serviceChamado.solicitar(6, { remedios: [{ idRemedio: 999, quantidade: 1 }] }), { status: 404 });
  assert.throws(() => serviceChamado.solicitar(6, { remedios: [{ idRemedio: 5, quantidade: 0 }] }), { status: 400 });
  assert.throws(() => serviceChamado.solicitar(6, {
    remedios: [{ idRemedio: 5, quantidade: 1 }, { idRemedio: 5, quantidade: 2 }],
  }), { status: 400 });
});

test("gerente vê o pendente da sua farmácia e aceita", () => {
  const { idChamado } = solicitar();

  const caixa = serviceChamado.listarDoGerente(3, "pendente");
  assert.ok(caixa.totalPendentes >= 1);
  assert.ok(caixa.chamados.every((c) => c.status === "pendente" && c.farmacia.idFarmacia === 3));
  assert.ok(caixa.chamados.some((c) => c.idChamado === idChamado));

  // gerente de outra farmácia não pode responder
  assert.throws(() => serviceChamado.responder(idChamado, { idGerente: 1, aceitar: true }), { status: 403 });

  const aceito = serviceChamado.responder(idChamado, { idGerente: 3, aceitar: true });
  assert.equal(aceito.status, "aceito");
  assert.equal(aceito.resposta.idGerente, 3);
  assert.ok(aceito.resposta.dataResposta);

  // não responde duas vezes
  assert.throws(() => serviceChamado.responder(idChamado, { idGerente: 3, aceitar: false, resposta: "x" }), { status: 409 });
  assert.ok(serviceChamado.listarDoFuncionario(6, "aceito").some((c) => c.idChamado === idChamado));
});

test("recusar exige motivo", () => {
  const { idChamado } = solicitar();
  assert.throws(() => serviceChamado.responder(idChamado, { idGerente: 3, aceitar: false }), { status: 400 });

  const recusado = serviceChamado.responder(idChamado, { idGerente: 3, aceitar: false, resposta: "Sem verba este mês" });
  assert.equal(recusado.status, "recusado");
  assert.equal(recusado.resposta.respostaGerente, "Sem verba este mês");
});

test("status inválido no filtro é recusado", () => {
  assert.throws(() => serviceChamado.listarDoGerente(3, "xyz"), { status: 400 });
});
