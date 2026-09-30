import {
  listarRedistribuicoesGerente,
  buscarRedistribuicao,
  responderRedistribuicao,
} from "../controller/redistribuicao.controller.mjs";

export default function redistribuicaoRoutes(router) {
  // aceita ?tipo=recebidos|enviados e ?status=
  router.get("/gerente/:id/redistribuicoes", listarRedistribuicoesGerente);

  router.get("/redistribuicao/:id", buscarRedistribuicao);

  router.put("/redistribuicao/:id/responder", responderRedistribuicao);
}
