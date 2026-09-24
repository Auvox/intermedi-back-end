import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { Router } from "../router.mjs";

process.env.INTERMEDI_DB_PATH = ":memory:";
const { default: db } = await import("../database/database.mjs");
const { aplicarSeed } = await import("../database/setup.mjs");
const { default: funcionarioRoutes } = await import("../routes/funcionario.routes.mjs");
aplicarSeed(db);
test.after(() => db.close());
const router = new Router();
funcionarioRoutes(router);

const payload = () => ({
  idFuncionario: 1, idPaciente: 1, idFarmacia: 1,
  observacao: "Entrega de medicamentos",
  remedios: [{ idRemedio: 1, quantidade: 2 }, { idRemedio: 2, quantidade: 1 }],
});
async function request(data) {
  const req = Readable.from([Buffer.from(JSON.stringify(data))]);
  const res = { setHeader() {}, end(body) { this.body = JSON.parse(body); } };
  await router.find("POST", "/servicos")(req, res);
  return res;
}
const contagens = () => [
  db.prepare("SELECT COUNT(*) AS n FROM servico").get().n,
  db.prepare("SELECT COUNT(*) AS n FROM servico_remedio").get().n,
];

test("GET /servicos retorna nomes e totais sem duplicar atendimentos", async () => {
  const res = { setHeader() {}, end(body) { this.body = JSON.parse(body); } };
  await router.find("GET", "/servicos")({}, res);
  assert.equal(res.statusCode, 200);
  const lista = res.body.servicos;
  assert.equal(lista.length, contagens()[0]);
  const exemplo = lista.find(s => s.idServico === 1);
  assert.equal(exemplo.nomePaciente, "Maria Santos");
  assert.equal(exemplo.totalMedicamentos, 2);
  assert.equal(exemplo.quantidadeTotal, 3);
  assert.equal(new Set(lista.map(s => s.idServico)).size, lista.length);
});

test("POST /servicos grava cabeçalho e vários itens com o mesmo id", async () => {
  const res = await request(payload());
  assert.equal(res.statusCode, 201);
  const id = res.body.recebido.idServico;
  const servico = db.prepare("SELECT * FROM servico WHERE id_servico = ?").get(id);
  assert.equal(servico.id_paciente, 1);
  assert.equal(servico.id_funcionario, 1);
  assert.equal(servico.id_farmacia, 1);
  assert.equal(servico.observacao, payload().observacao);
  assert.ok(servico.data_servico);
  const itens = db.prepare("SELECT * FROM servico_remedio WHERE id_servico = ? ORDER BY id_remedio").all(id);
  assert.deepEqual(itens.map(i => [i.id_servico, i.id_remedio, i.quantidade]), [[id, 1, 2], [id, 2, 1]]);
});

test("falha no segundo remédio desfaz cabeçalho e primeiro item", async () => {
  const antes = contagens();
  const data = payload();
  data.remedios[1].idRemedio = 999999;
  const res = await request(data);
  assert.equal(res.statusCode, 404);
  assert.deepEqual(contagens(), antes);
});

test("recusa dados inválidos sem gravar registros", async () => {
  const antes = contagens();
  for (const extra of [
    { idFuncionario: 0 }, { idPaciente: "1" }, { idFarmacia: null },
    { remedios: [] }, { remedios: null }, { remedios: [null] },
    { remedios: [{ idRemedio: 1, quantidade: 0 }] },
    { remedios: [{ idRemedio: 1, quantidade: 1.5 }] },
    { remedios: [{ idRemedio: 1, quantidade: 1 }, { idRemedio: 1, quantidade: 2 }] },
    { idFarmacia: 2 },
  ]) {
    assert.equal((await request({ ...payload(), ...extra })).statusCode, 400);
  }
  for (const campo of ["idFuncionario", "idPaciente", "idFarmacia"]) {
    assert.equal((await request({ ...payload(), [campo]: 999999 })).statusCode, 404);
  }
  assert.deepEqual(contagens(), antes);
});
