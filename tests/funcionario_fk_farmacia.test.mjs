import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// Banco temporário só para este teste (nunca mexe no database/intermedi.db)
const temp = await mkdtemp(path.join(tmpdir(), "intermedi-fk-"));
process.env.INTERMEDI_DB_PATH = path.join(temp, "test.db");

const { default: db } = await import("../database/database.mjs");
const serviceFuncionario = await import("../services/funcionario.service.mjs");
const serviceFarmacia = await import("../services/farmacia.service.mjs");

test.after(async () => {
  db.close();
  await rm(temp, { recursive: true, force: true });
});

const farmaciaTeste = () =>
  serviceFarmacia.cadastrar({
    nomeFarmacia: `Farmacia Teste ${Date.now()}`,
    cnesFarmacia: `CNES-${Date.now()}-${Math.random()}`,
    telFarmacia: "(11) 1111-2222",
  }).idFarmacia;

const payload = (idFarmacia, extra = {}) => ({
  nomeFuncionario: "Funcionario Teste",
  cpfFuncionario: `111.${Math.floor(100000000 + Math.random() * 900000000)}.000`,
  emailFuncionario: `teste_${Date.now()}_${Math.round(Math.random() * 1000)}@mail.com`,
  telFuncionario: "(11) 99999-0000",
  cargoFuncionario: "Farmaceutico",
  turnoFuncionario: "Manhã",
  fkIdFarmacia: idFarmacia,
  ...extra,
});

test("cadastrar funcionario grava id_farmacia, normaliza o turno e gera matrícula e senha", () => {
  const idFarmacia = farmaciaTeste();
  const criado = serviceFuncionario.cadastrar(payload(idFarmacia));

  const funcionario = serviceFuncionario.buscarPorId(criado.idFuncionario);
  assert.equal(funcionario.fkIdFarmacia, idFarmacia);
  assert.equal(funcionario.turnoFuncionario, "manha");
  assert.match(funcionario.matriculaFuncionario, /^\d{6}$/);
  assert.ok(criado.senhaProvisoria, "sem senha no payload deve gerar senha provisória");
  assert.equal("senhaFuncionario" in funcionario, false);

  const salvo = db.prepare("SELECT senha_hash FROM funcionario WHERE id_funcionario = ?").get(criado.idFuncionario);
  assert.match(salvo.senha_hash, /^scrypt\$/);
});

test("funcionario sem farmácia ou com farmácia inexistente é recusado", () => {
  assert.throws(() => serviceFuncionario.cadastrar(payload(undefined)), { status: 400 });
  assert.throws(() => serviceFuncionario.cadastrar(payload(999999)), /FOREIGN KEY/);
});

test("CPF duplicado retorna 409", () => {
  const idFarmacia = farmaciaTeste();
  const dados = payload(idFarmacia);
  serviceFuncionario.cadastrar(dados);
  assert.throws(
    () => serviceFuncionario.cadastrar({ ...dados, emailFuncionario: "outro@mail.com" }),
    { status: 409, message: "CPF já cadastrado." },
  );
});

test("farmácia com funcionários não pode ser apagada", () => {
  const idFarmacia = farmaciaTeste();
  serviceFuncionario.cadastrar(payload(idFarmacia));
  assert.throws(() => serviceFarmacia.deletar(idFarmacia), /FOREIGN KEY/);
});
