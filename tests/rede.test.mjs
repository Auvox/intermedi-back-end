import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const temp = await mkdtemp(path.join(tmpdir(), "intermedi-rede-"));
process.env.INTERMEDI_DB_PATH = path.join(temp, "test.db");

const { default: db } = await import("../database/database.mjs");
const { mapaDaRede } = await import("../services/rede.service.mjs");
const { autorizar } = await import("../services/acesso.service.mjs");

test.after(async () => {
  db.close();
  await rm(temp, { recursive: true, force: true });
});

const AGORA = Date.parse("2026-11-16T15:00:00Z");

const novaFarmacia = (nome, cnes) => {
  const endereco = db.prepare(`INSERT INTO endereco (logradouro, numero, bairro, cidade, uf, cep, latitude, longitude)
    VALUES ('Rua Teste', '1', 'Centro', 'Mogi das Cruzes', 'SP', '08700-000', -23.52, -46.18)`).run().lastInsertRowid;
  return Number(db.prepare("INSERT INTO farmacia (nome, cnes, id_endereco) VALUES (?, ?, ?)").run(nome, cnes, endereco).lastInsertRowid);
};
const ORIGEM = novaFarmacia("UBS Teste Origem", "9990001");
const DESTINO = novaFarmacia("UBS Teste Destino", "9990002");

function pedido(dados) {
  const [origem, destino] = [ORIGEM, DESTINO];
  const idRemedio = db.prepare("SELECT id_remedio FROM remedio ORDER BY id_remedio LIMIT 1").get()?.id_remedio
    ?? Number(db.prepare("INSERT INTO remedio (nome, dosagem) VALUES ('Dipirona', '500mg')").run().lastInsertRowid);
  const campos = { id_remedio: idRemedio, id_farmacia_origem: origem, id_farmacia_destino: destino, quantidade: 10, ...dados };
  const nomes = Object.keys(campos);
  return Number(db.prepare(`INSERT INTO redistribuicao (${nomes.join(", ")}) VALUES (${nomes.map(() => "?").join(", ")})`)
    .run(...Object.values(campos)).lastInsertRowid);
}

test("mapa da rede: farmácias com endereço e pedidos com os horários em ISO", () => {
  const recente = pedido({
    status: "recebida",
    data_solicitacao: "2026-11-16 12:00:00",
    data_envio: "2026-11-16 12:30:00",
    data_prevista_chegada: "2026-11-16 13:10:00",
    data_recebimento: "2026-11-16 13:12:00",
  });
  const antigo = pedido({ status: "recebida", data_solicitacao: "2026-01-02 10:00:00" });
  const aCaminho = pedido({ status: "enviada", data_solicitacao: "2026-01-03 10:00:00", data_envio: "2026-01-03 11:00:00" });

  const mapa = mapaDaRede({ dias: 30, agora: AGORA });
  assert.equal(mapa.agora, "2026-11-16T15:00:00.000Z");
  assert.ok(mapa.farmacias.length > 0);
  assert.ok(["idFarmacia", "nome", "cidade", "latitude", "longitude"].every((c) => c in mapa.farmacias[0]));

  const ids = mapa.pedidos.map((p) => p.idPedido);
  assert.ok(ids.includes(recente));
  assert.ok(!ids.includes(antigo), "fora do período");
  assert.ok(ids.includes(aCaminho), "em andamento entra mesmo se pedido antes do período");

  const p = mapa.pedidos.find((x) => x.idPedido === recente);
  assert.equal(p.enviadoEm, "2026-11-16T12:30:00Z");
  assert.equal(p.recebidoEm, "2026-11-16T13:12:00Z");
  assert.equal(p.aprovadoEm, null);
  assert.ok(p.nomeRemedio);

  assert.throws(() => mapaDaRede({ dias: 0 }), { status: 400 });
  assert.throws(() => mapaDaRede({ dias: 1.5 }), { status: 400 });
});

test("mapa da rede segue a regra do Desempenho: aberto sem login exigido, só admin com login", () => {
  delete process.env.INTERMEDI_EXIGIR_LOGIN;
  assert.doesNotThrow(() => autorizar({ headers: {} }, "GET /analytics/rede"));
  process.env.INTERMEDI_EXIGIR_LOGIN = "true";
  try {
    assert.throws(() => autorizar({ headers: {} }, "GET /analytics/rede"), { status: 401 });
  } finally {
    delete process.env.INTERMEDI_EXIGIR_LOGIN;
  }
});
