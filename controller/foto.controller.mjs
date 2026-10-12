import { fileURLToPath } from "node:url";
import * as serviceFoto from "../services/foto.service.mjs";
import { enviarErro, enviarJson, erro, idDaUrl } from "../utils/http.mjs";
import { enviarFoto, removerFoto, salvarFoto } from "../utils/foto.mjs";

// Fotos de funcionário, gerente e farmácia (padrão: uploads/fotos)
export const PASTA_FOTOS = process.env.INTERMEDI_UPLOAD_FOTOS_DIR ||
  fileURLToPath(new URL("../uploads/fotos/", import.meta.url));
const URL_FOTOS = "/uploads/fotos/";
const arquivoDaUrl = (url) => url?.startsWith(URL_FOTOS) ? url.slice(URL_FOTOS.length) : null;

// Apaga o arquivo da foto (usado ao deletar o cadastro)
export const apagarArquivoDaFoto = (url) => removerFoto(PASTA_FOTOS, arquivoDaUrl(url));

// PUT /<tabela>/:id/foto  (multipart/form-data, campo "foto")
async function enviar(req, res, tabela, rotulo) {
  try {
    const id = idDaUrl(req, rotulo);
    if (!serviceFoto.existe(tabela, id)) throw erro(404, `${rotulo} não encontrado`);

    const arquivo = await salvarFoto(req, PASTA_FOTOS);
    const url = URL_FOTOS + arquivo;
    let antiga;
    try {
      antiga = serviceFoto.atualizarFoto(tabela, id, url);
    } catch (error) {
      await removerFoto(PASTA_FOTOS, arquivo);
      throw error;
    }
    await apagarArquivoDaFoto(antiga);

    enviarJson(res, 200, { status: `Foto atualizada`, id, foto: url });
  } catch (error) {
    enviarErro(res, error);
  }
}

// DELETE /<tabela>/:id/foto
async function remover(req, res, tabela, rotulo) {
  try {
    const id = idDaUrl(req, rotulo);
    const antiga = serviceFoto.atualizarFoto(tabela, id, null);
    if (antiga === undefined) throw erro(404, `${rotulo} não encontrado`);
    await apagarArquivoDaFoto(antiga);

    enviarJson(res, 200, { status: "Foto removida", id, foto: null });
  } catch (error) {
    enviarErro(res, error);
  }
}

// funcionario
export const enviarFotoFuncionario = (req, res) => enviar(req, res, "funcionario", "Funcionario");
export const removerFotoFuncionario = (req, res) => remover(req, res, "funcionario", "Funcionario");

// gerente
export const enviarFotoGerente = (req, res) => enviar(req, res, "gerente", "Gerente");
export const removerFotoGerente = (req, res) => remover(req, res, "gerente", "Gerente");

// farmacia
export const enviarFotoFarmacia = (req, res) => enviar(req, res, "farmacia", "Farmácia");
export const removerFotoFarmacia = (req, res) => remover(req, res, "farmacia", "Farmácia");

// exibir a imagem (<img src="http://localhost:3000/uploads/fotos/...">)
export async function exibirFoto(req, res) {
  try {
    await enviarFoto(res, PASTA_FOTOS, req.params.arquivo);
  } catch (error) {
    enviarErro(res, error);
  }
}
