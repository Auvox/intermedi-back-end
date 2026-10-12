import {
  enviarFotoFuncionario,
  removerFotoFuncionario,
  enviarFotoGerente,
  removerFotoGerente,
  enviarFotoFarmacia,
  removerFotoFarmacia,
  exibirFoto,
} from "../controller/foto.controller.mjs";

export default function fotoRoutes(router) {
  // multipart/form-data, campo "foto" (JPEG, PNG ou WebP até 5 MB)
  router.put("/funcionario/:id/foto", enviarFotoFuncionario);

  router.delete("/funcionario/:id/foto", removerFotoFuncionario);

  router.put("/gerente/:id/foto", enviarFotoGerente);

  router.delete("/gerente/:id/foto", removerFotoGerente);

  router.put("/farmacia/:id/foto", enviarFotoFarmacia);

  router.delete("/farmacia/:id/foto", removerFotoFarmacia);

  router.get("/uploads/fotos/:arquivo", exibirFoto);
}
