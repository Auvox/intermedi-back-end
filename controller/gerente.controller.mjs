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

// busca pela farmácia do gerente atual, onde ele está cadastrado.
export async function consultarFarmaciaDoGerente(req, res) {
  try {
    const idGerente = idDaUrl(req, "Gerente"); // extrai o ID da URL (:id)
    
    const farmacia = serviceGerente.consultarFarmaciaDoGerente(idGerente);
    if (!farmacia) {
      throw erro(404, "Farmácia do gerente não encontrada.");
    }

    enviarJson(res, 200, {
      status: "Farmácia do gerente encontrada com sucesso",
      resultado: farmacia,
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

// consultar serviços do funcionário
export async function consultarServicosDoFuncionario(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const idGerente = Number(url.searchParams.get("idGerente"));
    const idFuncionario = Number(url.searchParams.get("idFuncionario"));

    if (!idGerente || Number.isNaN(idGerente)) {
      throw erro(400, "ID do gerente inválido.");
    }
    if (!idFuncionario || Number.isNaN(idFuncionario)) {
      throw erro(400, "ID do funcionário inválido.");
    }

    const servicos = serviceGerente.consultarServicosDoFuncionario(idGerente, idFuncionario);

    enviarJson(res, 200, {
      status: "Serviços do funcionário encontrados com sucesso",
      resultado: servicos,
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

export async function alterarEstoqueGerente(req, res) {
  try {
    const idGerente = idDaUrl(req, "Gerente"); // Extrai o primeiro ID da URL
    
    // Como a URL é /gerente/:id/estoque/:idEstoque, precisamos extrair o idEstoque também.
    // Dependendo de como sua função idDaUrl lida com múltiplos parâmetros, você pode extrair via regex da URL:
    const urlParts = req.url.split("/");
    // Exemplo de rota: ["", "gerente", "3", "estoque", "5"] -> O idEstoque estará no índice 4
    const idEstoque = Number(urlParts[4]);

    if (!idEstoque || Number.isNaN(idEstoque)) {
      throw erro(400, "ID do estoque inválido na URL.");
    }

    const data = await lerJson(req);
    const resultado = serviceGerente.alterarEstoque(idGerente, idEstoque, data);

    if (resultado.changes === 0) {
      throw erro(404, "Estoque não encontrado ou sem alterações realizadas.");
    }

    enviarJson(res, 200, {
      status: "ESTOQUE ATUALIZADO COM SUCESSO",
      alterados: resultado.changes,
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

// deslogar da conta
export async function logoutGerente(req, res) {
  try {
    enviarJson(res, 200, {
      mensagem: "Sessão encerrada com sucesso.",
    });
  } catch (error) {
    enviarErro(res, error);
  }
}