import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirBanco, aplicarSchema, aplicarSeed } from '../database/setup.mjs';
import { atualizarFarmaciasPublicas } from '../database/farmacias-publicas.mjs';

test('corrige exemplos preservando IDs, estoques e pacientes; repetir não duplica endereços', () => {
  const db = abrirBanco(':memory:');
  try {
    aplicarSchema(db);
    aplicarSeed(db);
    const estoques = db.prepare('SELECT * FROM estoque ORDER BY id_estoque').all();
    const pacientes = db.prepare('SELECT * FROM paciente ORDER BY id_paciente').all();
    atualizarFarmaciasPublicas(db);
    assert.equal(db.prepare('SELECT nome FROM farmacia WHERE id_farmacia = 1').get().nome, 'UBS Guaianases II');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM farmacia').get().n, 7);
    const enderecos = db.prepare('SELECT * FROM endereco ORDER BY id_endereco').all();
    atualizarFarmaciasPublicas(db);
    assert.deepEqual(db.prepare('SELECT * FROM endereco ORDER BY id_endereco').all(), enderecos);
    assert.deepEqual(db.prepare('SELECT * FROM estoque ORDER BY id_estoque').all(), estoques);
    assert.deepEqual(db.prepare('SELECT * FROM paciente ORDER BY id_paciente').all(), pacientes);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM farmacia f JOIN endereco e ON e.id_endereco = f.id_endereco WHERE e.latitude IS NOT NULL AND e.longitude IS NOT NULL').get().n, 7);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally { db.close(); }
});

test('preserva farmácia desconhecida e desfaz alterações se ocorrer falha', () => {
  const db = abrirBanco(':memory:');
  try {
    aplicarSchema(db);
    db.prepare('INSERT INTO farmacia (nome, cnes) VALUES (?, ?)').run('Cadastro pessoal', '1234567');
    atualizarFarmaciasPublicas(db);
    assert.equal(db.prepare('SELECT nome FROM farmacia WHERE id_farmacia = 1').get().nome, 'Cadastro pessoal');
    const antes = db.prepare('SELECT * FROM farmacia').all();
    db.exec("CREATE TRIGGER falha_publicas BEFORE UPDATE ON farmacia WHEN NEW.cnes = '2787083' BEGIN SELECT RAISE(ABORT, 'falha simulada'); END");
    assert.throws(() => atualizarFarmaciasPublicas(db), /falha simulada/);
    assert.deepEqual(db.prepare('SELECT * FROM farmacia').all(), antes);
  } finally { db.close(); }
});
