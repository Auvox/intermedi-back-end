import test from "node:test";
import assert from "node:assert/strict";

// Banco em memória (nunca mexe no banco local)
process.env.INTERMEDI_DB_PATH = ":memory:";
const { default: db } = await import("../database/database.mjs");
const { autorizar } = await import("../services/acesso.service.mjs");
test.after(() => db.close());

const semToken = () => ({ headers: {} });

function comLogin(valor, fn) {
  const antes = process.env.INTERMEDI_EXIGIR_LOGIN;
  if (valor === undefined) delete process.env.INTERMEDI_EXIGIR_LOGIN;
  else process.env.INTERMEDI_EXIGIR_LOGIN = valor;
  try {
    fn();
  } finally {
    if (antes === undefined) delete process.env.INTERMEDI_EXIGIR_LOGIN;
    else process.env.INTERMEDI_EXIGIR_LOGIN = antes;
  }
}

test("sem INTERMEDI_EXIGIR_LOGIN, rotas da equipe funcionam sem token (como o front usa hoje)", () => {
  comLogin(undefined, () => {
    const req = semToken();
    assert.doesNotThrow(() => autorizar(req, "GET /funcionario"));
    assert.doesNotThrow(() => autorizar(req, "POST /gerente"));
    assert.doesNotThrow(() => autorizar(req, "PUT /gerente/:id/estoque/:idRemedio", { id: "3", idRemedio: "5" }));
    assert.equal(req.usuario, undefined);
    // /auth/me continua dizendo que não há sessão
    assert.throws(() => autorizar(semToken(), "GET /auth/me"), { status: 401 });
  });
});

test("com INTERMEDI_EXIGIR_LOGIN=true, as regras de acesso valem", () => {
  comLogin("true", () => {
    assert.throws(() => autorizar(semToken(), "GET /funcionario"), { status: 401 });
    assert.doesNotThrow(() => autorizar(semToken(), "GET /remedios"), "rota pública");
  });
});
