import {
  cadastrarFuncionario,
  cadastrarServico,
  consultarServicos,
  buscarServico,
  consultarFuncionario,
  buscarFuncionario,
  editarFuncionario,
  deletarFuncionario,
  logoutFuncionario,
} from "../controller/funcionario.controller.mjs";

export default function funcionarioRoutes(router) {
  router.post("/servicos", cadastrarServico);

  router.get("/servicos", consultarServicos);
  router.get("/servicos/:id", buscarServico);

  router.post("/funcionario", cadastrarFuncionario);

  router.post("/funcionario/logout", logoutFuncionario);

  router.get("/funcionario", consultarFuncionario);

  router.get("/funcionario/:id", buscarFuncionario);

  router.put("/funcionario/:id", editarFuncionario);

  router.delete("/funcionario/:id", deletarFuncionario);
}
