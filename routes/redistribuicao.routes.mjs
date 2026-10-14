import {
  listarRedistribuicoesGerente,
  buscarRedistribuicao,
  responderRedistribuicao,
  iniciarPreparoRedistribuicao,
  listarPreparosFuncionario,
} from "../controller/redistribuicao.controller.mjs";

export default function redistribuicaoRoutes(router) {
  // aceita ?tipo=recebidos|enviados e ?status=
  router.get("/gerente/:id/redistribuicoes", listarRedistribuicoesGerente);

  router.get("/redistribuicao/:id", buscarRedistribuicao);

  router.put("/redistribuicao/:id/responder", responderRedistribuicao);

  // preparo pelo funcionário da farmácia fornecedora
  router.post("/redistribuicao/:id/preparar", iniciarPreparoRedistribuicao);
  router.get("/funcionario/:id/preparos", listarPreparosFuncionario);
}
