import * as serviceGerente from "../services/gerente.service.mjs";

// cadastrar gerente
export async function cadastrarGerente(req, res) {
  try {
    const chunks = [];

    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const body = Buffer.concat(chunks).toString("utf-8");

    const data = JSON.parse(body);

    const gerente = serviceGerente.cadastrar(data);

    res.statusCode = 201;
    res.setHeader("Content-Type", "application/json");

    res.end(
      JSON.stringify({
        status: "CADASTRADO COM SUCESSO - POST",
        recebido: gerente,
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

// listar gerente
export async function consultarGerente(req, res) {
  try {
    const gerente = serviceGerente.listar();

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");

    res.end(
      JSON.stringify({
        mensagem: "TODOS OS GERENTES CADASTRADOS - GET",
        gerente,
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

// buscar gerentes por id
export async function buscarGerente(req, res) {
  try {
    const id = req.params.id;
    const gerente = serviceGerente.buscarPorId(id);

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");

    res.end(
      JSON.stringify({
        status: "gerente encontrado",
        resultado: gerente,
      }),
    );
  } catch {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");

    res.end(
      JSON.stringify({
        error: "gerente nao encontrado",
      }),
    );
  }
}

// editar gerente
export async function editarGerente(req, res) {
  const id = req.params.id;
  try {
    const chunks = [];

    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const body = Buffer.concat(chunks).toString("utf-8");
    console.log("BODY", body);
    const dataGerente = JSON.parse(body);

    const gerente = serviceGerente.editar(id, dataGerente);

    res.statusCode = 201;
    res.setHeader("ContentType", "application/json");

    res.end(
      JSON.stringify({
        status: "gerente atualizado",
        alterados: gerente.changes,
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

// deletar gerente
export async function deletarGerente(req, res) {
  const id = Number(req.params.id);

  try {
    const deleteGerente = serviceGerente.deletar(id);

    // se o gerente nao existir
    if (deleteGerente.changes === 0) {
      res.statusCode = 404;

      return res.end(
        JSON.stringify({
          error: "gerente não encontrado",
        }),
      );
    }

    res.setHeader("Content-Type", "application/json");

    res.end(
      JSON.stringify({
        mensagem: "gerente Deletado!",
        deletado: deleteGerente,
      }),
    );
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");

    res.end(
      JSON.stringify({
        error: "Erro ao deletar gerente",
      }),
    );
  }
}
