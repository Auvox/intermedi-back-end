import * as serviceFarmacia from "../services/farmacia.service.mjs";

// cadastrar remedio
export async function cadastrarFarmacia(req, res) {
  try {
    const chunks = [];

    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const body = Buffer.concat(chunks).toString("utf-8");

    const data = JSON.parse(body);

    const farmacia = serviceFarmacia.cadastrar(data);

    res.statusCode = 201;
    res.setHeader("Content-Type", "application/json");

    res.end(
      JSON.stringify({
        status: "CADASTRADO COM SUCESSO - POST",
        recebido: farmacia,
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

// listar farmacias
export async function consultarFarmacia(req, res) {
  try {
    const farmacia = serviceFarmacia.listar();

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");

    res.end(
      JSON.stringify({
        mensagem: "TODOS OS REMEDIO CADASTRADOS - GET",
        farmacia,
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

// buscar farmacia por id
export async function buscarFarmacia(req, res) {
  try {
    const id = req.params.id;
    const farmacia = serviceFarmacia.buscarPorId(id);

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");

    res.end(
      JSON.stringify({
        status: "farmacia encontrado",
        resultado: farmacia,
      }),
    );
  } catch {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");

    res.end(
      JSON.stringify({
        error: "farmacia nao encontrado",
      }),
    );
  }
}

// editar farmacia
export async function editarFarmacia(req, res) {
  const id = req.params.id;
  try {
    const chunks = [];

    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const body = Buffer.concat(chunks).toString("utf-8");
    console.log("BODY", body);
    const dataFarmacia = JSON.parse(body);

    const farmacia = serviceFarmacia.editar(id, dataFarmacia);

    res.statusCode = 201;
    res.setHeader("Content-Type", "application/json");

    res.end(
      JSON.stringify({
        status: "Farmacia atualizado",
        alterados: farmacia.changes,
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

// deletar farmacia
export async function deletarFarmacia(req, res) {
  const id = Number(req.params.id);

  try {
    const deleteFarmacia = serviceFarmacia.deletar(id);

    // se o farmacia nao existir
    if (deleteFarmacia.changes === 0) {
      res.statusCode = 404;

      return res.end(
        JSON.stringify({
          error: "Farmacia não encontrado",
        }),
      );
    }

    res.setHeader("Content-Type", "application/json");

    res.end(
      JSON.stringify({
        mensagem: "Farmacia Deletado!",
        deletado: deleteFarmacia,
      }),
    );
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");

    res.end(
      JSON.stringify({
        error: "Erro ao deletar farmacia",
      }),
    );
  }
}
