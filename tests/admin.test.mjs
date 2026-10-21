import test from "node:test";
import assert from "node:assert/strict";

// Banco em memória com os dados do seed (nunca mexe no banco local)
process.env.INTERMEDI_DB_PATH = ":memory:";
const { default: db } = await import("../database/database.mjs");
const { aplicarSeed } = await import("../database/setup.mjs");
const { verificarSenha } = await import("../utils/senha.mjs");
const serviceAdmin = await import("../services/admin.service.mjs");
aplicarSeed(db);
test.after(() => db.close());

test("admin do seed tem hash de senha no formato scrypt$salt$hash", () => {
  const { senha_hash: hash } = db.prepare("SELECT senha_hash FROM admin WHERE email = ?").get("admin@intermedi.com");
  assert.match(hash, /^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
});

test("gerente cadastrado pelo admin consegue usar a senha informada", () => {
  const { idGerente } = serviceAdmin.cadastrarGerenteAdmin({
    nome: "Gerente Teste Admin",
    cpf: "98765432100",
    email: "gerente.admin@teste.intermedi.com",
    senha: "senha-do-gerente",
    crf: "CRF-SP-99999",
    matricula: "GER-ADM-TESTE",
    idFarmacia: 1,
  });

  const { senha_hash: hash } = db.prepare("SELECT senha_hash FROM gerente WHERE id_gerente = ?").get(idGerente);
  assert.ok(verificarSenha("senha-do-gerente", hash));
  assert.equal(verificarSenha("outra-senha", hash), false);
});

test("login do admin recusa senha errada", () => {
  assert.throws(() => serviceAdmin.autenticar({ email: "admin@intermedi.com", senha: "errada" }), { status: 401 });
  assert.throws(() => serviceAdmin.autenticar({ email: "", senha: "" }), { status: 400 });
});
