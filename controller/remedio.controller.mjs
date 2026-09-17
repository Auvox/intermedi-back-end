import * as serviceRemedio from "../services/remedio.service.mjs";
import { enviarErro, enviarJson, erro, idDaUrl, lerJson } from "../utils/http.mjs";

// cadastrar remedio
export async function cadastrarRemedio(req, res) {
  try {
    const data = await lerJson(req);
    const remedio = serviceRemedio.cadastrar(data);

    enviarJson(res, 201, {
      status: "CADASTRADO COM SUCESSO - POST",
      recebido: remedio,
    });
  } catch (error) {
    enviarErro(res, error);
  }
}

// listar remedio
export async function consultarRemedio(req, res) {
  try {
    // filtro opcional: GET /remedios?categoria=Dor de cabeça
    const categoria = new URL(req.url, "http://localhost").searchParams.get("categoria");
    const remedios = serviceRemedio.listar(categoria);
    enviarJson(res, 200, {
      mensagem: "TODOS OS REMEDIO CADASTRADOS - GET",
      remedios,
    });
  } catch (error) {
    enviarErro(res, error);
  }
}

// buscar remedio por id
export async function buscarRemedio(req, res) {
  try {
    const id = idDaUrl(req, "Remedio");
    const remedio = serviceRemedio.buscarPorId(id);
    if (!remedio) throw erro(404, "Remedio nao encontrado");

    enviarJson(res, 200, {
      status: "Remedio encontrado",
      resultado: remedio,
    });
  } catch (error) {
    enviarErro(res, error);
  }
}

// editar remedio
export async function editarRemedio(req, res) {
  try {
    const id = idDaUrl(req, "Remedio");
    const data = await lerJson(req);
    const remedio = serviceRemedio.editar(id, data);
    if (remedio.changes === 0) throw erro(404, "Remedio não encontrado");

    enviarJson(res, 201, {
      status: "Remedio atualizado",
      alterados: remedio.changes,
    });
  } catch (error) {
    enviarErro(res, error);
  }
}

// deletar remedio
export async function deletarRemedio(req, res) {
  try {
    const id = idDaUrl(req, "Remedio");
    const deletado = serviceRemedio.deletar(id);
    if (deletado.changes === 0) throw erro(404, "Remedio não encontrado");

    enviarJson(res, 200, {
      mensagem: "Remedio Deletado!",
      deletado,
    });
  } catch (error) {
    enviarErro(res, error);
  }
}
