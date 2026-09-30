import {
  cadastrarGerente,
  consultarGerente,
  consultarFarmaciaDoGerente,
  buscarGerente,
  editarGerente,
  deletarGerente,
  logoutGerente,
} from "../controller/gerente.controller.mjs";

export default function gerenteRoutes(router) {
  router.post("/gerente", cadastrarGerente);

  router.post("/gerente/logout", logoutGerente);

  router.get("/gerente", consultarGerente);

  router.get("/gerente/:id/farmacia", consultarFarmaciaDoGerente);

  router.get("/gerente/:id", buscarGerente);

  router.put("/gerente/:id", editarGerente);

  router.delete("/gerente/:id", deletarGerente);
}
