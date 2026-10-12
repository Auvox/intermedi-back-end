import * as serviceChamado from "../services/chamado.service.mjs";
import { enviarErro, enviarJson, erro, idDaUrl, lerJson } from "../utils/http.mjs";

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

// gerente aceita (abre o chamado para a rede de farmácias) ou recusa
export async function responderChamado(req, res) {
  try {
    const idChamado = idDaUrl(req, "Chamado");
    const data = await lerJson(req);
    const { chamado, despacho } = serviceChamado.responder(idChamado, data);

    enviarJson(res, 200, {
      status: chamado.status === "recusado" ? "CHAMADO RECUSADO - PUT" : "CHAMADO ACEITO - PUT",
      chamado,
      // para qual farmácia cada remédio foi pedido (enviadoPara null = nenhuma tem)
      despacho,
    });
  } catch (error) {
    enviarErro(res, error);
  }
}

// detalhe do chamado (com a situação de cada remédio e o histórico de pedidos)
export async function buscarChamado(req, res) {
  try {
    const idChamado = idDaUrl(req, "Chamado");
    const chamado = serviceChamado.buscarPorId(idChamado);
    if (!chamado) throw erro(404, "Chamado não encontrado");

    enviarJson(res, 200, { status: "Chamado encontrado", chamado });
  } catch (error) {
    enviarErro(res, error);
  }
}

// antes de aceitar: quais farmácias têm os remédios do chamado
// GET /chamado/:id/disponibilidade?idGerente=3
export async function disponibilidadeChamado(req, res) {
  try {
    const idChamado = idDaUrl(req, "Chamado");
    const idGerente = new URL(req.url, "http://localhost").searchParams.get("idGerente");
    const resultado = serviceChamado.disponibilidade(idChamado, idGerente);

    enviarJson(res, 200, { mensagem: "DISPONIBILIDADE NA REDE - GET", ...resultado });
  } catch (error) {
    enviarErro(res, error);
  }
}

// tenta de novo os remédios que ficaram sem fornecedor
export async function redistribuirChamado(req, res) {
  try {
    const idChamado = idDaUrl(req, "Chamado");
    const data = await lerJson(req);
    const { chamado, despacho } = serviceChamado.redistribuir(idChamado, data.idGerente);

    enviarJson(res, 200, { status: "REDISTRIBUIÇÃO REFEITA - POST", chamado, despacho });
  } catch (error) {
    enviarErro(res, error);
  }
}
