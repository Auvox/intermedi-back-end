import * as serviceFuncionario from "../services/funcionario.service.mjs";

// cadastrar funcionario
export async function cadastrarFuncionario(req, res) {
  let data;

  try {
    const chunks = [];

    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const body = Buffer.concat(chunks).toString("utf-8");

    data = JSON.parse(body);
  } catch {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");

    return res.end(
      JSON.stringify({
        error: "O corpo da requisição deve ser um JSON válido.",
      }),
    );
  }

  try {
    const funcionario = serviceFuncionario.cadastrar(data);

    res.statusCode = 201;
    res.setHeader("Content-Type", "application/json; charset=utf-8");

    res.end(
      JSON.stringify({
        status: "CADASTRADO COM SUCESSO - POST",
        recebido: funcionario,
      }),
    );
  } catch (error) {
    console.error("Erro ao cadastrar funcionário:", error);

    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");

    res.end(
      JSON.stringify({
        error: "Não foi possível cadastrar o funcionário.",
      }),
    );
  }
}

// listar funcionario
export async function consultarFuncionario(req, res) {
  try {
    const funcionario = serviceFuncionario.listar();

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");

    res.end(
      JSON.stringify({
        mensagem: "TODOS OS FUNCIONARIOS CADASTRADOS - GET",
        funcionario,
      }),
    );
  } catch (error) {
    res.statusCode = 400;

    setHeader("Content-Type", "application/json");

    res.end(
      JSON.stringify({
        error: "JSON inválido",
      }),
    );
  }
}

// buscar funcionario por id
export async function buscarFuncionario(req, res) {
  try {
    const id = req.params.id;
    const funcionario = serviceFuncionario.buscarPorId(id);

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");

    res.end(
      JSON.stringify({
        status: "funcionario encontrado",
        resultado: funcionario,
      }),
    );
  } catch {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");

    res.end(
      JSON.stringify({
        error: "funcionario nao encontrado",
      }),
    );
  }
}

// editar funcionario
export async function editarFuncionario(req, res) {
  const id = req.params.id;
  try {
    const chunks = [];

    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const body = Buffer.concat(chunks).toString("utf-8");
    console.log("BODY", body);
    const dataFuncionario = JSON.parse(body);

    const funcionario = serviceFuncionario.editar(id, dataFuncionario);

    res.statusCode = 201;
    res.setHeader("Content-Type", "application/json");

    res.end(
      JSON.stringify({
        status: "funcionario atualizado",
        alterados: funcionario.changes,
      }),
    );
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");

    res.end(
      JSON.stringify({
        error: error.message,
      }),
    );
  }
}

// deletar funcionario
export async function deletarFuncionario(req, res) {
  const id = Number(req.params.id);

  try {
    const deleteFuncionario = serviceFuncionario.deletar(id);

    // se o funcionario nao existir
    if (deleteFuncionario.changes === 0) {
      res.statusCode = 404;

      return res.end(
        JSON.stringify({
          error: "Funcionario não encontrado",
        }),
      );
    }

    res.setHeader("Content-Type", "application/json");

    res.end(
      JSON.stringify({
        mensagem: "Funcionario Deletado!",
        deletado: deleteFuncionario,
      }),
    );
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");

    res.end(
      JSON.stringify({
        error: "Erro ao deletar funcionario",
      }),
    );
  }
}
