import test from "node:test";
import assert from "node:assert/strict";
import { geocodificarEndereco } from "../services/geocodificacao.service.mjs";

test("geocodificação valida endereço, resposta e falhas sem chamar a API real", async () => {
  const endereco = { logradouro: "Rua Teste", numero: "123", bairro: "Centro", cidade: "São Paulo", uf: "SP", cep: "01000-000" };
  const fetchOriginal = globalThis.fetch;
  const chaveOriginal = process.env.GEOAPIFY_API_KEY;
  try {
    delete process.env.GEOAPIFY_API_KEY;
    await assert.rejects(geocodificarEndereco(endereco), { status: 503 });
    process.env.GEOAPIFY_API_KEY = "chave-de-teste";
    await assert.rejects(geocodificarEndereco({ cidade: "São Paulo" }), { status: 400 });
    globalThis.fetch = async (url) => {
      assert.equal(url.searchParams.get("filter"), "countrycode:br");
      assert.match(url.searchParams.get("text"), /Rua Teste, 123/);
      return { ok: true, json: async () => ({ results: [{ lat: -23.55, lon: -46.63, housenumber: "123" }] }) };
    };
    assert.deepEqual(await geocodificarEndereco(endereco), { latitude: -23.55, longitude: -46.63 });
    for (const results of [[], [{ lat: -23.55, lon: -46.63 }], [{ lat: -23.55, lon: -46.63, housenumber: "999" }]]) {
      globalThis.fetch = async () => ({ ok: true, json: async () => ({ results }) });
      assert.equal(await geocodificarEndereco(endereco), null);
    }
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ results: [{ lat: null, lon: -46.63 }] }) });
    await assert.rejects(geocodificarEndereco(endereco), { status: 502 });
    globalThis.fetch = async () => ({ ok: false });
    await assert.rejects(geocodificarEndereco(endereco), { status: 503 });
    globalThis.fetch = async () => { throw new Error("timeout"); };
    await assert.rejects(geocodificarEndereco(endereco), { status: 503 });
  } finally {
    globalThis.fetch = fetchOriginal;
    if (chaveOriginal === undefined) delete process.env.GEOAPIFY_API_KEY;
    else process.env.GEOAPIFY_API_KEY = chaveOriginal;
  }
});
