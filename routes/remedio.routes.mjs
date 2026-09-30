import {
  cadastrarRemedio,
  consultarRemedio,
  buscarRemedio,
  editarRemedio,
  deletarRemedio,
  enviarFotoRemedio,
  removerFotoRemedio,
  exibirFotoRemedio,
} from "../controller/remedio.controller.mjs";

export default function remedioRoutes(router) {

  router.post("/remedios", cadastrarRemedio);

  // aceita ?busca= e ?categoria=
  router.get("/remedios", consultarRemedio);

  router.get("/remedios/:id", buscarRemedio);

  router.put("/remedios/:id", editarRemedio);

  router.delete("/remedios/:id", deletarRemedio);

  // foto do remedio
  router.put("/remedios/:id/foto", enviarFotoRemedio);

  router.delete("/remedios/:id/foto", removerFotoRemedio);

  router.get("/uploads/remedios/:arquivo", exibirFotoRemedio);

}
