import {
  cadastrarGerente,
  consultarGerente,
  consultarFarmaciaDoGerente,
  consultarServicosDoFuncionario,
  buscarGerente,
  editarGerente,
  deletarGerente,
  logoutGerente,
  alterarEstoqueGerente,
} from "../controller/gerente.controller.mjs";

export default function gerenteRoutes(router) {
  // Rotas específicas ANTES das rotas dinâmicas (:id)
  router.get("/gerente/funcionario/servicos", consultarServicosDoFuncionario);
  router.get("/gerente/:id/farmacia", consultarFarmaciaDoGerente);
  router.post("/gerente/logout", logoutGerente);
  
  // Altera um registro de estoque pelo id_estoque. Fica em /registro/ para não
  // capturar o PUT /gerente/:id/estoque/:idRemedio (estoque.routes), que o front usa.
  router.put("/gerente/:id/estoque/registro/:idEstoque", alterarEstoqueGerente);

  // Rotas padrão
  router.post("/gerente", cadastrarGerente);
  router.get("/gerente", consultarGerente);
  router.get("/gerente/:id", buscarGerente);
  router.put("/gerente/:id", editarGerente);
  router.delete("/gerente/:id", deletarGerente);
}