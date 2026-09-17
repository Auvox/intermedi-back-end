import * as serviceFarmacia from "../services/farmacia.service.mjs";
import { enviarErro, enviarJson, erro, idDaUrl, lerJson } from "../utils/http.mjs";

// cadastrar farmacia
export async function cadastrarFarmacia(req, res) {
  try {
    const data = await lerJson(req);
    const farmacia = serviceFarmacia.cadastrar(data);

    enviarJson(res, 201, {
      status: "CADASTRADO COM SUCESSO - POST",
      recebido: farmacia,
    });
  } catch (error) {
    enviarErro(res, error);
  }
}

// listar farmacia
export async function consultarFarmacia(req, res) {
  try {
    const farmacia = serviceFarmacia.listar();
    enviarJson(res, 200, {
      mensagem: "TODAS AS FARMACIAS CADASTRADAS - GET",
      farmacia,
    });
  } catch (error) {
    enviarErro(res, error);
  }
}

// buscar farmacia por id
export async function buscarFarmacia(req, res) {
  try {
    const id = idDaUrl(req, "Farmacia");
    const farmacia = serviceFarmacia.buscarPorId(id);
    if (!farmacia) throw erro(404, "farmacia nao encontrado");

    enviarJson(res, 200, {
      status: "farmacia encontrado",
      resultado: farmacia,
    });
  } catch (error) {
    enviarErro(res, error);
  }
}

// editar farmacia
export async function editarFarmacia(req, res) {
  try {
    const id = idDaUrl(req, "Farmacia");
    const data = await lerJson(req);
    const farmacia = serviceFarmacia.editar(id, data);
    if (farmacia.changes === 0) throw erro(404, "Farmacia não encontrado");

    enviarJson(res, 201, {
      status: "farmacia atualizado",
      alterados: farmacia.changes,
    });
  } catch (error) {
    enviarErro(res, error);
  }
}

// deletar farmacia
export async function deletarFarmacia(req, res) {
  try {
    const id = idDaUrl(req, "Farmacia");
    const deletado = serviceFarmacia.deletar(id);
    if (deletado.changes === 0) throw erro(404, "Farmacia não encontrado");

    enviarJson(res, 200, {
      mensagem: "Farmacia Deletado!",
      deletado,
    });
  } catch (error) {
    enviarErro(res, error);
  }
}
