import {
  cadastrarFuncionario,
  consultarFuncionario,
  buscarFuncionario,
  editarFuncionario,
  deletarFuncionario,
} from "../controller/funcionario.controller.mjs";

export default function funcionarioRoutes(router) {
  router.post("/funcionario", cadastrarFuncionario);

  router.get("/funcionario", consultarFuncionario);

  router.get("/funcionario/:id", buscarFuncionario);

  router.put("/funcionario/:id", editarFuncionario);

  router.delete("/funcionario/:id", deletarFuncionario);
}
