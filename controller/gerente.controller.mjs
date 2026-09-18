import * as serviceGerente from "../services/gerente.service.mjs";
import { enviarErro, enviarJson, erro, idDaUrl, lerJson } from "../utils/http.mjs";

// cadastrar gerente
export async function cadastrarGerente(req, res) {
  try {
    const data = await lerJson(req);
    const gerente = serviceGerente.cadastrar(data);

    enviarJson(res, 201, {
      status: "CADASTRADO COM SUCESSO - POST",
      recebido: gerente,
    });
  } catch (error) {
    enviarErro(res, error);
    console.log(error)
  }
}

// listar gerente
export async function consultarGerente(req, res) {
  try {
    const gerente = serviceGerente.listar();
    enviarJson(res, 200, {
      mensagem: "TODOS OS GERENTES CADASTRADOS - GET",
      gerente,
    });
  } catch (error) {
    enviarErro(res, error);


  }
}

// buscar gerente por id
export async function buscarGerente(req, res) {
  try {
    const id = idDaUrl(req, "Gerente");
    const gerente = serviceGerente.buscarPorId(id);
    if (!gerente) throw erro(404, "gerente nao encontrado");

    enviarJson(res, 200, {
      status: "gerente encontrado",
      resultado: gerente,
    });
  } catch (error) {
    enviarErro(res, error);
  }
}

// editar gerente
export async function editarGerente(req, res) {
  try {
    const id = idDaUrl(req, "Gerente");
    const data = await lerJson(req);
    const gerente = serviceGerente.editar(id, data);
    if (gerente.changes === 0) throw erro(404, "Gerente não encontrado");

    enviarJson(res, 201, {
      status: "gerente atualizado",
      alterados: gerente.changes,
    });
  } catch (error) {
    enviarErro(res, error);
  }
}

// deletar gerente
export async function deletarGerente(req, res) {
  try {
    const id = idDaUrl(req, "Gerente");
    const deletado = serviceGerente.deletar(id);
    if (deletado.changes === 0) throw erro(404, "Gerente não encontrado");

    enviarJson(res, 200, {
      mensagem: "Gerente Deletado!",
      deletado,
    });
  } catch (error) {
    enviarErro(res, error);
  }
}
