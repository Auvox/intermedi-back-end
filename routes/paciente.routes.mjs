import {
  cadastrarPaciente,
  listarOuBuscarPacientes,
  buscarPaciente,
  editarPaciente,
  deletarPaciente,
  logoutPaciente,
} from "../controller/paciente.controller.mjs";

export default function pacienteRoutes(router) {
  router.post("/paciente", cadastrarPaciente);

  router.post("/paciente/logout", logoutPaciente);

  router.get("/paciente", listarOuBuscarPacientes);

  router.get("/paciente/:id", buscarPaciente);

  router.put("/paciente/:id", editarPaciente);

  router.delete("/paciente/:id", deletarPaciente);
}
