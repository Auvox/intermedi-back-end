import {
  cadastrarFarmacia,
  consultarFarmacia,
  buscarFarmacia,
  editarFarmacia,
  deletarFarmacia,
} from "../controller/farmacia.controller.mjs";

export default function farmaciaRoutes(router) {
  router.post("/farmacia", cadastrarFarmacia);

  router.get("/farmacia", consultarFarmacia);

  router.get("/farmacia/:id", buscarFarmacia);

  router.put("/farmacia/:id", editarFarmacia);

  router.delete("/farmacia/:id", deletarFarmacia);
}
