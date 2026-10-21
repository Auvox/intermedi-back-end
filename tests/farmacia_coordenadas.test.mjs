import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { aplicarSchema } from '../database/setup.mjs';

process.env.INTERMEDI_DB_PATH = ':memory:';
const { default: db } = await import('../database/database.mjs');
const service = await import('../services/farmacia.service.mjs');
const endereco = {
  enderecoFarmacia: 'Rua Comandante Carlos Ruhl', numeroFarmacia: '189',
  bairroFarmacia: 'Guaianases', cidadeFarmacia: 'São Paulo', ufFarmacia: 'SP', cepFarmacia: '08410-120',
};
const fetchAnterior = globalThis.fetch;
const chaveAnterior = process.env.GEOAPIFY_API_KEY;
process.env.GEOAPIFY_API_KEY = 'teste-local';
globalThis.fetch = async () => ({ ok: true, json: async () => ({ results: [] }) });
let sequence = 0;
async function criar(extra = {}) {
  return (await service.cadastrar({ nomeFarmacia: 'Teste mapa', cnesFarmacia: `geo-${++sequence}`, ...endereco, ...extra })).idFarmacia;
}

test('migra banco antigo duas vezes sem perder farmácias ou endereços', async () => {
  const antigo = new DatabaseSync(':memory:');
  const sql = readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8')
    .replace(/^    latitude\s+REAL.*\n/m, '').replace(/^    longitude\s+REAL.*\n/m, '');
  antigo.exec(sql);
  antigo.prepare("INSERT INTO farmacia (nome, cnes) VALUES (?, ?)").run('Preservar', 'antigo');
  aplicarSchema(antigo);
  aplicarSchema(antigo);
  assert.equal(antigo.prepare('SELECT COUNT(*) AS n FROM farmacia').get().n, 1);
  assert.equal(antigo.prepare('SELECT latitude, longitude FROM farmacia').get().latitude, null);
  assert.equal(antigo.prepare('PRAGMA foreign_key_check').all().length, 0);
  antigo.close();
});

test('salva e devolve o mesmo par na lista e nos detalhes', async () => {
  const id = await criar({ latitude: '-23.54548', longitude: '-46.41554' });
  const detalhe = service.buscarPorId(id);
  assert.equal(detalhe.latitude, -23.54548);
  assert.equal(detalhe.longitude, -46.41554);
  assert.equal(service.listar().find(f => f.idFarmacia === id).latitude, detalhe.latitude);
  await service.editar(id, { nomeFarmacia: 'Nome novo' });
  assert.equal(service.buscarPorId(id).latitude, detalhe.latitude);
});

test('endereço novo invalida o ponto antigo; endereço igual o preserva', async () => {
  const id = await criar({ latitude: -23.54548, longitude: -46.41554 });
  await service.editar(id, { ...endereco, estadoFarmacia: 'SP' });
  assert.equal(service.buscarPorId(id).latitude, -23.54548);
  await service.editar(id, { numeroFarmacia: '200' });
  assert.equal(service.buscarPorId(id).latitude, null);
  assert.equal(service.buscarPorId(id).longitude, null);
  await service.editar(id, { numeroFarmacia: '201', latitude: -23.545, longitude: -46.415 });
  assert.equal(service.buscarPorId(id).latitude, -23.545);
});

test('sem coordenadas continua compatível; aceita remover o par explicitamente', async () => {
  const id = await criar();
  assert.equal(service.buscarPorId(id).latitude, null);
  await service.editar(id, { latitude: -23.5, longitude: -46.4 });
  await service.editar(id, { latitude: null, longitude: null });
  assert.equal(service.buscarPorId(id).latitude, null);
  assert.equal(service.buscarPorId(id).longitude, null);
});

test('rejeita ponto incompleto, vazio, não numérico ou fora da faixa antes de gravar', async () => {
  const id = await criar({ latitude: -23.5, longitude: -46.4 });
  for (const ponto of [
    { latitude: -23.5 }, { longitude: -46.4 }, { latitude: null, longitude: -46.4 },
    { latitude: '', longitude: '' }, { latitude: false, longitude: -46.4 },
    { latitude: 'NaN', longitude: -46.4 }, { latitude: 91, longitude: 0 },
    { latitude: -23.5, longitude: 181 },
  ]) await assert.rejects(() => service.editar(id, ponto), { status: 400 });
  assert.equal(service.buscarPorId(id).latitude, -23.5);
  assert.equal(service.buscarPorId(id).longitude, -46.4);
});

test.after(() => {
  db.close();
  globalThis.fetch = fetchAnterior;
  if (chaveAnterior === undefined) delete process.env.GEOAPIFY_API_KEY;
  else process.env.GEOAPIFY_API_KEY = chaveAnterior;
});
