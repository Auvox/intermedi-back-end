import {
  cadastrarGerente,
  consultarGerente,
  buscarGerente,
  editarGerente,
  deletarGerente,
  consultarFarmaciaDoGerente,
  consultarServicosDoFuncionario,
  logoutGerente,
} from "../controller/gerente.controller.mjs";

export default function gerenteRoutes(router) {
  // Rotas específicas devem ser registradas ANTES das rotas dinâmicas (:id)
  router.get("/gerente/funcionario/servicos", consultarServicosDoFuncionario);
  router.get("/gerente/:id/farmacia", consultarFarmaciaDoGerente);
  router.post("/gerente/logout", logoutGerente);

  // Rotas padrão
  router.post("/gerente", cadastrarGerente);
  router.get("/gerente", consultarGerente);
  router.get("/gerente/:id", buscarGerente);
  router.put("/gerente/:id", editarGerente);
  router.delete("/gerente/:id", deletarGerente);
}