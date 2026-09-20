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

// listar remedios
// para exibir um remédio (realizar uma busca) digitando um termo incompleto já retornará
// por exemplo (http://localhost:3000/remedios?busca=dipi) retornará o remédio "Dipirona"

// buscar remedio pela categoria
/*por exemplo (http://localhost:3000/remedios?categoria=do) retornará o remédio que for da categoria 
"Dor de cabeça, Febre" */

// para exibir todos os remédios basta fazer uma busca na url sem inserir um termo (ex: http://localhost:3000/remedios)
export async function listarOuBuscarRemedios(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    
    // Captura os query params da URL
    const termo = url.searchParams.get("busca") || "";
    const categoria = url.searchParams.get("categoria") || "";

    // 1. Se informou um termo genérico de busca (nome/descrição)
    if (termo.trim()) {
      const resultados = serviceRemedio.buscarPorTermo(termo);
      return enviarJson(res, 200, resultados);
    }

    // 2. Se informou 'categoria', o service fará a busca parcial (%termo%)
    // Se 'categoria' e 'busca' forem vazias, o service retornará todos os remédios normalmente
    const remedios = serviceRemedio.listar(categoria);
    return enviarJson(res, 200, remedios);

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
