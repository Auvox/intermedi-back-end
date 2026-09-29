import * as serviceChamado from "../services/chamado.service.mjs";
import { enviarErro, enviarJson, idDaUrl, lerJson } from "../utils/http.mjs";

// funcionario solicita um chamado para o gerente
export async function solicitarChamado(req, res) {
  try {
    const idFuncionario = idDaUrl(req, "Funcionario");
    const data = await lerJson(req);
    const chamado = serviceChamado.solicitar(idFuncionario, data);

    enviarJson(res, 201, {
      status: "SOLICITAÇÃO ENVIADA AO GERENTE - POST",
      chamado,
    });
  } catch (error) {
    enviarErro(res, error);
  }
}

const statusDaQuery = (req) => new URL(req.url, "http://localhost").searchParams.get("status");

// notificações do gerente: chamados da farmácia dele (?status=pendente)
export async function listarChamadosGerente(req, res) {
  try {
    const idGerente = idDaUrl(req, "Gerente");
    const { totalPendentes, chamados } = serviceChamado.listarDoGerente(idGerente, statusDaQuery(req));

    enviarJson(res, 200, {
      mensagem: "CHAMADOS DA FARMÁCIA - GET",
      totalPendentes,
      chamados,
    });
  } catch (error) {
    enviarErro(res, error);
  }
}

// chamados que o funcionario solicitou (para acompanhar a resposta)
export async function listarChamadosFuncionario(req, res) {
  try {
    const idFuncionario = idDaUrl(req, "Funcionario");
    const chamados = serviceChamado.listarDoFuncionario(idFuncionario, statusDaQuery(req));

    enviarJson(res, 200, {
      mensagem: "CHAMADOS SOLICITADOS PELO FUNCIONARIO - GET",
      chamados,
    });
  } catch (error) {
    enviarErro(res, error);
  }
}

// gerente aceita ou recusa o chamado
export async function responderChamado(req, res) {
  try {
    const idChamado = idDaUrl(req, "Chamado");
    const data = await lerJson(req);
    const chamado = serviceChamado.responder(idChamado, data);

    enviarJson(res, 200, {
      status: chamado.status === "aceito" ? "CHAMADO ACEITO - PUT" : "CHAMADO RECUSADO - PUT",
      chamado,
    });
  } catch (error) {
    enviarErro(res, error);
  }
}
