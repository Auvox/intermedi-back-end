import * as serviceEstoque from "../services/estoque.service.mjs";
import { enviarErro, enviarJson, erro, idDaUrl, lerJson } from "../utils/http.mjs";

const filtrosDaQuery = (req) => {
  const params = new URL(req.url, "http://localhost").searchParams;
  return { busca: params.get("busca"), situacao: params.get("situacao") };
};

// listar estoque de uma farmácia (funcionário/gerente/admin)
// GET /farmacia/:id/estoque?busca=para&situacao=critico
export async function consultarEstoque(req, res) {
  try {
    const idFarmacia = idDaUrl(req, "Farmácia");
    const resultado = serviceEstoque.listarDaFarmacia(idFarmacia, filtrosDaQuery(req));

    enviarJson(res, 200, { mensagem: "ESTOQUE DA FARMÁCIA - GET", ...resultado });
  } catch (error) {
    enviarErro(res, error);
  }
}

// listar estoque da farmácia do gerente
export async function consultarEstoqueGerente(req, res) {
  try {
    const idGerente = idDaUrl(req, "Gerente");
    const resultado = serviceEstoque.listarDoGerente(idGerente, filtrosDaQuery(req));

    enviarJson(res, 200, { mensagem: "ESTOQUE DA FARMÁCIA - GET", ...resultado });
  } catch (error) {
    enviarErro(res, error);
  }
}

// gerente adiciona um remédio do catálogo no estoque da farmácia dele
export async function cadastrarEstoque(req, res) {
  try {
    const idGerente = idDaUrl(req, "Gerente");
    const data = await lerJson(req);
    const item = serviceEstoque.cadastrar(idGerente, data);

    enviarJson(res, 201, {
      status: "REMEDIO ADICIONADO AO ESTOQUE - POST",
      recebido: item,
    });
  } catch (error) {
    enviarErro(res, error);
  }
}

// gerente ajusta quantidade / entrada / estoque mínimo / lote / validade
export async function editarEstoque(req, res) {
  try {
    const idGerente = idDaUrl(req, "Gerente");
    const idRemedio = idDaUrl(req, "Remédio", "idRemedio");
    const data = await lerJson(req);
    const item = serviceEstoque.editar(idGerente, idRemedio, data);
    if (!item) throw erro(404, "Remédio não está no estoque desta farmácia");

    enviarJson(res, 200, {
      status: "Estoque atualizado",
      resultado: item,
    });
  } catch (error) {
    enviarErro(res, error);
  }
}

// gerente tira o remédio do estoque da farmácia
export async function deletarEstoque(req, res) {
  try {
    const idGerente = idDaUrl(req, "Gerente");
    const idRemedio = idDaUrl(req, "Remédio", "idRemedio");
    const deletado = serviceEstoque.deletar(idGerente, idRemedio);
    if (!deletado) throw erro(404, "Remédio não está no estoque desta farmácia");

    enviarJson(res, 200, {
      mensagem: "Remedio removido do estoque!",
      deletado: { idEstoque: deletado.idEstoque, idRemedio: deletado.idRemedio, nomeRemedio: deletado.nomeRemedio },
    });
  } catch (error) {
    enviarErro(res, error);
  }
}
