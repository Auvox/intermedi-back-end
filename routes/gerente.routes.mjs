import {
  cadastrarGerente,
  consultarGerente,
  buscarGerente,
  editarGerente,
  deletarGerente,
} from "../controller/gerente.controller.mjs";

export default function gerenteRoutes(router) {
  router.post("/gerente", cadastrarGerente);

  router.get("/gerente", consultarGerente);

  router.get("/gerente/:id", buscarGerente);

  router.put("/gerente/:id", editarGerente);

  router.delete("/gerente/:id", deletarGerente);
}
