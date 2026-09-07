
import {
  cadastrarRemedio,
  consultarRemedio,
  buscarRemedio,
  editarRemedio,
  deletarRemedio
} from "../controller/remedio.controller.mjs";

export default function remedioRoutes(router) {

  router.post("/remedios", cadastrarRemedio);

  router.get("/remedios", consultarRemedio);

  router.get("/remedios/:id", buscarRemedio);

  router.put("/remedios/:id", editarRemedio);

  router.delete("/remedios/:id", deletarRemedio);

}