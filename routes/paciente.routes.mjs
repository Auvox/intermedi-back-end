import {
  cadastrarPaciente,
  consultarPaciente,
  buscarPaciente,
  editarPaciente,
  deletarPaciente,
} from "../controller/paciente.controller.mjs";

export default function pacienteRoutes(router) {
  router.post("/paciente", cadastrarPaciente);

  router.get("/paciente", consultarPaciente);

  router.get("/paciente/:id", buscarPaciente);

  router.put("/paciente/:id", editarPaciente);

  router.delete("/paciente/:id", deletarPaciente);
}
