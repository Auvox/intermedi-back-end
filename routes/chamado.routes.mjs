import {
  solicitarChamado,
  listarChamadosFuncionario,
  listarChamadosGerente,
  responderChamado,
} from "../controller/chamado.controller.mjs";

export default function chamadoRoutes(router) {
  // funcionario
  router.post("/funcionario/:id/chamado", solicitarChamado);

  router.get("/funcionario/:id/chamados", listarChamadosFuncionario);

  // gerente
  router.get("/gerente/:id/chamados", listarChamadosGerente);

  router.put("/chamado/:id/responder", responderChamado);
}
