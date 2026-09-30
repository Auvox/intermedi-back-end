import {
  resumoFuncionario,
  resumoGerente,
  resumoFarmacia,
  resumoRemedio,
  resumoPaciente,
} from "../controller/resumo.controller.mjs";

// Detalhe ao clicar em um item das listas (aceitam ?periodo= ou ?de=&ate=)
export default function resumoRoutes(router) {
  router.get("/funcionario/:id/resumo", resumoFuncionario);

  router.get("/gerente/:id/resumo", resumoGerente);

  router.get("/farmacia/:id/resumo", resumoFarmacia);

  router.get("/remedios/:id/resumo", resumoRemedio);

  router.get("/paciente/:id/resumo", resumoPaciente);
}
