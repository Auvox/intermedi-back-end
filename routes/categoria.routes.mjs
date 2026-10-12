import { consultarCategorias } from "../controller/categoria.controller.mjs";

export default function categoriaRoutes(router) {
  router.get("/categorias", consultarCategorias);
}
