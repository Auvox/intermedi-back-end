import * as ativacao from "../services/ativacao.service.mjs";
import { enviarErro, enviarJson, idDaUrl } from "../utils/http.mjs";

const ROTULOS = { farmacia: "Farmácia", gerente: "Gerente", funcionario: "Funcionário", paciente: "Paciente" };

// DELETE /<tipo>/:id  -> desativa (o cadastro continua no banco)
export const desativar = (tipo) => async (req, res) => {
  try {
    const id = idDaUrl(req, ROTULOS[tipo]);
    const situacao = ativacao.desativar(tipo, id);
    enviarJson(res, 200, { mensagem: `${ROTULOS[tipo]} desativado(a).`, id, ...situacao });
  } catch (error) {
    enviarErro(res, error);
  }
};

// PUT /<tipo>/:id/reativar
export const reativar = (tipo) => async (req, res) => {
  try {
    const id = idDaUrl(req, ROTULOS[tipo]);
    const situacao = ativacao.reativar(tipo, id);
    enviarJson(res, 200, { mensagem: `${ROTULOS[tipo]} reativado(a).`, id, ...situacao });
  } catch (error) {
    enviarErro(res, error);
  }
};
