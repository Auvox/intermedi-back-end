import test from "node:test";
import assert from "node:assert/strict";

// Banco em memória (os controllers abrem o banco ao serem importados)
process.env.INTERMEDI_DB_PATH = ":memory:";
const { Router } = await import("../router.mjs");
const { default: gerenteRoutes } = await import("../routes/gerente.routes.mjs");
const { default: estoqueRoutes } = await import("../routes/estoque.routes.mjs");
const { editarEstoque } = await import("../controller/estoque.controller.mjs");
const { alterarEstoqueGerente } = await import("../controller/gerente.controller.mjs");
const { default: db } = await import("../database/database.mjs");
test.after(() => db.close());

// Mesma ordem do server.mjs: rotas do gerente antes das de estoque
const router = new Router();
gerenteRoutes(router);
estoqueRoutes(router);

// Troca os handlers por um que só conta qual rota foi escolhida
for (const [rota, handler] of Object.entries(router.routes.PUT)) {
  router.routes.PUT[rota] = (req) => ({ handler, params: req.params });
}
const resolver = (pathname) => router.find("PUT", pathname)({});

test("PUT /gerente/:id/estoque/:idRemedio continua indo para o editarEstoque", () => {
  const { handler, params } = resolver("/gerente/3/estoque/5");
  assert.equal(handler, editarEstoque);
  assert.deepEqual(params, { id: "3", idRemedio: "5" });
});

test("alteração por id_estoque fica em /estoque/registro/:idEstoque", () => {
  const { handler, params } = resolver("/gerente/3/estoque/registro/12");
  assert.equal(handler, alterarEstoqueGerente);
  assert.deepEqual(params, { id: "3", idEstoque: "12" });
});
