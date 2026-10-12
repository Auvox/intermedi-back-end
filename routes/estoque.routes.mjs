import {
  consultarEstoque,
  consultarEstoqueGerente,
  cadastrarEstoque,
  editarEstoque,
  deletarEstoque,
} from "../controller/estoque.controller.mjs";

export default function estoqueRoutes(router) {
  // qualquer plataforma consulta (aceita ?busca= e ?situacao=)
  router.get("/farmacia/:id/estoque", consultarEstoque);

  // gerente: só mexe no estoque da própria farmácia
  router.get("/gerente/:id/estoque", consultarEstoqueGerente);

  router.post("/gerente/:id/estoque", cadastrarEstoque);

  router.put("/gerente/:id/estoque/:idRemedio", editarEstoque);

  router.delete("/gerente/:id/estoque/:idRemedio", deletarEstoque);
}
