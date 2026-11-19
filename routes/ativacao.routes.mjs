import { desativar, reativar } from "../controller/ativacao.controller.mjs";
import { exibirFotoPadrao } from "../controller/foto-padrao.controller.mjs";

// Registrado depois das rotas de cada cadastro: o DELETE passa a DESATIVAR
// (o registro continua no banco e pode ser reativado).
export default function ativacaoRoutes(router) {
  for (const tipo of ["farmacia", "gerente", "funcionario", "paciente"]) {
    router.delete(`/${tipo}/:id`, desativar(tipo));
    router.put(`/${tipo}/:id/reativar`, reativar(tipo));
  }

  // Fotos padrão versionadas no repositório (remédios, farmácias, pessoas)
  router.get("/fotos-padrao/:arquivo", exibirFotoPadrao);
}
