import test from "node:test";
import assert from "node:assert/strict";

process.env.INTERMEDI_DB_PATH = ":memory:";
const { default: db } = await import("../database/database.mjs");
const farmacia = await import("../services/farmacia.service.mjs");

test("farmácia salva coordenadas, evita consultas desnecessárias e limpa posição antiga", async () => {
  const fetchOriginal = globalThis.fetch;
  const chaveOriginal = process.env.GEOAPIFY_API_KEY;
  let consultas = 0;
  let results = [{ lat: -23.55, lon: -46.63, housenumber: "123" }];
  process.env.GEOAPIFY_API_KEY = "teste";
  globalThis.fetch = async () => {
    consultas++;
    return { ok: true, json: async () => ({ results }) };
  };
  try {
    const criada = await farmacia.cadastrar({ nomeFarmacia: "Teste", cnesFarmacia: "TESTE-1",
      enderecoFarmacia: "Rua Teste", numeroFarmacia: "123", bairroFarmacia: "Centro",
      cidadeFarmacia: "São Paulo", ufFarmacia: "SP", cepFarmacia: "01000-000" });
    assert.equal(farmacia.buscarPorId(criada.idFarmacia).latitude, -23.55);
    assert.equal(farmacia.listar()[0].longitude, -46.63);
    await farmacia.editar(criada.idFarmacia, { nomeFarmacia: "Outro nome", complementoFarmacia: "Loja 2" });
    assert.equal(consultas, 1);
    assert.equal(farmacia.buscarPorId(criada.idFarmacia).latitude, -23.55);
    results = [];
    await farmacia.editar(criada.idFarmacia, { numeroFarmacia: "456" });
    assert.equal(consultas, 2);
    assert.equal(farmacia.buscarPorId(criada.idFarmacia).latitude, null);
    assert.equal(farmacia.buscarPorId(criada.idFarmacia).longitude, null);
    globalThis.fetch = async () => { throw new Error("offline"); };
    await assert.rejects(farmacia.editar(criada.idFarmacia, { numeroFarmacia: "789" }), { status: 503 });
    assert.equal(farmacia.buscarPorId(criada.idFarmacia).numeroFarmacia, "456");
  } finally {
    globalThis.fetch = fetchOriginal;
    if (chaveOriginal === undefined) delete process.env.GEOAPIFY_API_KEY;
    else process.env.GEOAPIFY_API_KEY = chaveOriginal;
    db.close();
  }
});
