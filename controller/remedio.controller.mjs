import { fileURLToPath } from "node:url";
import * as serviceRemedio from "../services/remedio.service.mjs";
import { enviarErro, enviarJson, erro, idDaUrl, lerJson } from "../utils/http.mjs";
import { enviarFoto, removerFoto, salvarFoto } from "../utils/foto.mjs";

// Pasta das fotos dos remédios (padrão: uploads/remedios)
const PASTA_FOTOS = process.env.INTERMEDI_UPLOAD_REMEDIOS_DIR ||
  fileURLToPath(new URL("../uploads/remedios/", import.meta.url));
const URL_FOTOS = "/uploads/remedios/";
const arquivoDaUrl = (url) => url?.startsWith(URL_FOTOS) ? url.slice(URL_FOTOS.length) : null;

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

// listar remedios
// GET /remedios                      -> todos
// GET /remedios?busca=dipi           -> nome, princípio ativo ou dosagem contendo o termo
// GET /remedios?categoria=dor        -> categoria contendo o termo
// (os dois filtros podem ser usados juntos)
export async function consultarRemedio(req, res) {
  try {
    const params = new URL(req.url, "http://localhost").searchParams;
    const remedios = serviceRemedio.listar({
      busca: params.get("busca"),
      categoria: params.get("categoria"),
    });

    enviarJson(res, 200, {
      mensagem: "TODOS OS REMEDIO CADASTRADOS - GET",
      total: remedios.length,
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

// editar remedio (só os campos enviados mudam)
export async function editarRemedio(req, res) {
  try {
    const id = idDaUrl(req, "Remedio");
    const data = await lerJson(req);
    const remedio = serviceRemedio.editar(id, data);
    if (!remedio) throw erro(404, "Remedio não encontrado");

    enviarJson(res, 200, {
      status: "Remedio atualizado",
      alterados: 1,
      resultado: remedio,
    });
  } catch (error) {
    enviarErro(res, error);
  }
}

// deletar remedio (e a foto dele)
export async function deletarRemedio(req, res) {
  try {
    const id = idDaUrl(req, "Remedio");
    const deletado = serviceRemedio.deletar(id);
    if (!deletado) throw erro(404, "Remedio não encontrado");
    await removerFoto(PASTA_FOTOS, arquivoDaUrl(deletado.fotoRemedio));

    enviarJson(res, 200, {
      mensagem: "Remedio Deletado!",
      deletado: { changes: 1, idRemedio: deletado.idRemedio, nomeRemedio: deletado.nomeRemedio },
    });
  } catch (error) {
    enviarErro(res, error);
  }
}

// enviar/trocar a foto do remedio (multipart/form-data, campo "foto")
export async function enviarFotoRemedio(req, res) {
  try {
    const id = idDaUrl(req, "Remedio");
    if (!serviceRemedio.buscarPorId(id)) throw erro(404, "Remedio não encontrado");

    const arquivo = await salvarFoto(req, PASTA_FOTOS);
    let fotoAntiga;
    try {
      fotoAntiga = serviceRemedio.atualizarFoto(id, URL_FOTOS + arquivo);
    } catch (error) {
      await removerFoto(PASTA_FOTOS, arquivo);
      throw error;
    }
    await removerFoto(PASTA_FOTOS, arquivoDaUrl(fotoAntiga));

    enviarJson(res, 200, {
      status: "Foto do remedio atualizada",
      resultado: serviceRemedio.buscarPorId(id),
    });
  } catch (error) {
    enviarErro(res, error);
  }
}

// remover a foto do remedio
export async function removerFotoRemedio(req, res) {
  try {
    const id = idDaUrl(req, "Remedio");
    const fotoAntiga = serviceRemedio.atualizarFoto(id, null);
    if (fotoAntiga === undefined) throw erro(404, "Remedio não encontrado");
    await removerFoto(PASTA_FOTOS, arquivoDaUrl(fotoAntiga));

    enviarJson(res, 200, {
      status: "Foto do remedio removida",
      resultado: serviceRemedio.buscarPorId(id),
    });
  } catch (error) {
    enviarErro(res, error);
  }
}

// exibir a imagem (usada no <img src="http://localhost:3000/uploads/remedios/...">)
export async function exibirFotoRemedio(req, res) {
  try {
    await enviarFoto(res, PASTA_FOTOS, req.params.arquivo);
  } catch (error) {
    enviarErro(res, error);
  }
}
