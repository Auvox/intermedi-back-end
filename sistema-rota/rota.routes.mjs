import { consultarRota } from "./rota.controller.mjs";

export default function rotaRoutes(router) {
  router.post("/rotas", consultarRota);
}