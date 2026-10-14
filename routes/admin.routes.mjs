import { 
    loginAdmin, 
    listarGerentes,
    cadastrarGerente,
    listarPacientes,
    pesquisarPacientes
} from "../controller/admin.controller.mjs";

export function registrarRotasAdmin(router) {
  router.post("/admin/login", loginAdmin);
  router.get("/admin/gerentes", listarGerentes);
  router.post("/admin/gerentes", cadastrarGerente);
  router.get("/admin/pacientes", listarPacientes);
  router.get("/admin/pacientes/pesquisar", pesquisarPacientes);
}