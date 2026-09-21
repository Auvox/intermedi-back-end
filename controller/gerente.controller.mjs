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
  }
}

// busca gerente
// ex: "http://localhost:3000/gerente", retornará todos os gerentes
// busca funcionarios pelo termo "funcionario"
// ex: "http://localhost:3000/gerente?funcionario=1"
// retornará "Lucas Pereira" e todas as informações referentes ao funcionário.
export async function consultarGerente(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const idGerenteParam = url.searchParams.get("idGerente");
    const idFuncionarioParam = url.searchParams.get("funcionario");

    // Caso o gerente esteja tentando consultar um funcionário
    if (idFuncionarioParam) {
      if (!idGerenteParam) {
        throw erro(400, "Informe o idGerente na URL para realizar a consulta (ex: ?idGerente=1&funcionario=2).");
      }

      const idGerente = Number(idGerenteParam);
      const idFuncionario = Number(idFuncionarioParam);

      if (Number.isNaN(idGerente) || idGerente <= 0) {
        throw erro(400, "ID do gerente inválido.");
      }

      if (Number.isNaN(idFuncionario) || idFuncionario <= 0) {
        throw erro(400, "ID do funcionário inválido.");
      }

      // Executa a busca com a verificação de permissão
      const funcionario = serviceGerente.consultarFuncionarioDoGerente(idGerente, idFuncionario);

      return enviarJson(res, 200, {
        status: "Funcionário encontrado com sucesso",
        resultado: funcionario,
      });
    }

    // Caso não passe o parâmetro funcionario, faz a listagem normal de gerentes
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
