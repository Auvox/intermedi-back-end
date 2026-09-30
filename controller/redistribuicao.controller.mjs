import * as serviceRedistribuicao from "../services/redistribuicao.service.mjs";
import { enviarErro, enviarJson, erro, idDaUrl, lerJson } from "../utils/http.mjs";

// pedidos entre farmácias do gerente
// GET /gerente/:id/redistribuicoes?tipo=recebidos  -> notificações: outras farmácias pedindo para a minha
// GET /gerente/:id/redistribuicoes?tipo=enviados   -> meus pedidos (acompanhar a entrega)
// (opcional) &status=solicitada|enviada|recebida|recusada
export async function listarRedistribuicoesGerente(req, res) {
  try {
    const idGerente = idDaUrl(req, "Gerente");
    const params = new URL(req.url, "http://localhost").searchParams;
    const resultado = serviceRedistribuicao.listarDoGerente(idGerente, {
      tipo: params.get("tipo"),
      status: params.get("status"),
    });

    enviarJson(res, 200, { mensagem: "PEDIDOS ENTRE FARMÁCIAS - GET", ...resultado });
  } catch (error) {
    enviarErro(res, error);
  }
}

// detalhe de um pedido
export async function buscarRedistribuicao(req, res) {
  try {
    const id = idDaUrl(req, "Pedido");
    const pedido = serviceRedistribuicao.buscarPorId(id);
    if (!pedido) throw erro(404, "Pedido não encontrado");

    enviarJson(res, 200, { status: "Pedido encontrado", pedido });
  } catch (error) {
    enviarErro(res, error);
  }
}

// gerente da farmácia fornecedora aceita ou recusa o pedido
export async function responderRedistribuicao(req, res) {
  try {
    const id = idDaUrl(req, "Pedido");
    const data = await lerJson(req);
    const { pedido, encaminhadoPara } = serviceRedistribuicao.responder(id, data);

    enviarJson(res, 200, {
      status: pedido.status === "enviada" ? "PEDIDO ACEITO - REMÉDIO A CAMINHO - PUT" : "PEDIDO RECUSADO - PUT",
      pedido,
      // só na recusa: para qual farmácia o pedido foi repassado (null = nenhuma tem)
      encaminhadoPara,
    });
  } catch (error) {
    enviarErro(res, error);
  }
}
