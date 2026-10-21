import { 
    loginAdmin, 
    listarGerentes,
    cadastrarGerente,
    listarPacientes,
    pesquisarPacientes,
    receberChamadoExterno,
    desativarFarmacia,
    listarHistoricoChamados,
    listarHistoricoChamadosInternos,
    editarRemedio
} from "../controller/admin.controller.mjs";

export function registrarRotasAdmin(router) {
  router.post("/admin/login", loginAdmin);
  router.get("/admin/gerentes", listarGerentes);
  router.post("/admin/gerentes", cadastrarGerente);
  router.get("/admin/pacientes", listarPacientes);
  router.get("/admin/pacientes/pesquisar", pesquisarPacientes);
  router.post("/admin/chamados", receberChamadoExterno);
  router.post("/admin/farmacias/:id/desativar", desativarFarmacia);
  router.get("/admin/chamados/historico", listarHistoricoChamados);
  router.get("/admin/chamados/internos/historico", listarHistoricoChamadosInternos);
  router.put("/admin/remedios/:id/editar", editarRemedio);
}