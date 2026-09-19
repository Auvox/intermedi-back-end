import {
  cadastrarPaciente,
  listarOuBuscarPacientes,
  buscarPaciente,
  editarPaciente,
  deletarPaciente,
} from "../controller/paciente.controller.mjs";

export default function pacienteRoutes(router) {
  router.post("/paciente", cadastrarPaciente);

  router.get("/paciente", listarOuBuscarPacientes);

  router.get("/paciente/:id", buscarPaciente);

  router.put("/paciente/:id", editarPaciente);

  router.delete("/paciente/:id", deletarPaciente);
}
