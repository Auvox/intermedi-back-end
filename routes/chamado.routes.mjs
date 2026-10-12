import {
  solicitarChamado,
  listarChamadosFuncionario,
  listarChamadosGerente,
  responderChamado,
  buscarChamado,
  disponibilidadeChamado,
  redistribuirChamado,
} from "../controller/chamado.controller.mjs";

export default function chamadoRoutes(router) {
  // funcionario
  router.post("/funcionario/:id/chamado", solicitarChamado);

  router.get("/funcionario/:id/chamados", listarChamadosFuncionario);

  // gerente
  router.get("/gerente/:id/chamados", listarChamadosGerente);

  router.get("/chamado/:id", buscarChamado);

  router.get("/chamado/:id/disponibilidade", disponibilidadeChamado);

  router.put("/chamado/:id/responder", responderChamado);

  router.post("/chamado/:id/redistribuir", redistribuirChamado);
}
