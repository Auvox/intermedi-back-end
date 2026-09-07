import * as serviceRemedio from "../services/remedio.service.js";

// cadastrar remedio
export async function cadastrarRemedio(req, res) {
  try {
    const chunks = [];

    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const body = Buffer.concat(chunks).toString("utf-8");

    const data = JSON.parse(body);

    const remedio = serviceRemedio.cadastrar(data);

    res.statusCode = 201;
    res.setHeader("Content-Type", "application/json");

    res.end(
      JSON.stringify({
        status: "CADASTRADO COM SUCESSO - POST",
        recebido: remedio,
      }),
    );
  } catch (error) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");

    res.end(
      JSON.stringify({
        error: "JSON inválido",
      }),
    );
  }
}

// listar remedios
export async function consultarRemedio(req, res) {
  try {
    const remedios = serviceRemedio.listar();

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");

    res.end(
      JSON.stringify({
        mensagem: "TODOS OS REMEDIO CADASTRADOS - GET",
        remedios,
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

// buscar remedios por id
export async function buscarRemedio(req, res) {
  try {
    const id = req.params.id;
    const remedio = serviceRemedio.buscarPorId(id);

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");

    res.end(
      JSON.stringify({
        status: "Remedio encontrado",
        resultado: remedio,
      }),
    );
  } catch {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");

    res.end(
      JSON.stringify({
        error: "Remedio nao encontrado",
      }),
    );
  }
}

// editar remedio
export async function editarRemedio(req, res) {
  const id = req.params.id;
  try {
    const chunks = [];

    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const body = Buffer.concat(chunks).toString("utf-8");
    console.log("BODY", body);
    const dataRemedio = JSON.parse(body);

    const remedio = serviceRemedio.editar(id, dataRemedio);

    res.statusCode = 201;
    res.setHeader("ContentType", "application/json");

    res.end(
      JSON.stringify({
        status: "Remedio atualizado",
        alterados: remedio.changes,
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

// deletar remedio
export async function deletarRemedio(req, res) {
  const id = Number(req.params.id);

  try {
    const deleteRemedio = serviceRemedio.deletar(id)

    // se o remedio nao existir
    if (deleteRemedio.changes === 0) {
      res.statusCode = 404;

      return res.end(
        JSON.stringify({
          error: "Remedio não encontrado",
        }),
      );
    }

    res.setHeader("Content-Type", "application/json");

    res.end(
      JSON.stringify({
        mensagem: "Remedio Deletado!",
        deletado: deleteRemedio,
      }),
    );
  } catch (error) {

    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");

    res.end(
      JSON.stringify({
        error: "Erro ao deletar remedio",
      }),
    );
  }
}
