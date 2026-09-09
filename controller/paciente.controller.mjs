import * as servicePaciente from "../services/paciente.service.mjs";

// cadastrar paciente
export async function cadastrarPaciente(req, res) {
  try {
    const chunks = [];

    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const body = Buffer.concat(chunks).toString("utf-8");

    const data = JSON.parse(body);

    const paciente = servicePaciente.cadastrar(data);

    res.statusCode = 201;
    res.setHeader("Content-Type", "application/json");

    res.end(
      JSON.stringify({
        status: "CADASTRADO COM SUCESSO - POST",
        recebido: paciente,
      }),
    );
  } catch (error) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");

    res.end(
      JSON.stringify({
        error: error.message,
      }),
    );
  }
}

// listar paciente
export async function consultarPaciente(req, res) {
  try {
    const paciente = servicePaciente.listar();

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");

    res.end(
      JSON.stringify({
        mensagem: "TODOS OS PACIENTES CADASTRADOS - GET",
        paciente,
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

// buscar paciente por id
export async function buscarPaciente(req, res) {
  try {
    const id = req.params.id;
    const paciente = servicePaciente.buscarPorId(id);

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");

    res.end(
      JSON.stringify({
        status: "paciente encontrado",
        resultado: paciente,
      }),
    );
  } catch {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");

    res.end(
      JSON.stringify({
        error: "paciente nao encontrado",
      }),
    );
  }
}

// editar paciente
export async function editarPaciente(req, res) {
  const id = req.params.id;
  try {
    const chunks = [];

    for await (const chunk of req) {
      chunks.push(chunk);
    }

    const body = Buffer.concat(chunks).toString("utf-8");
    console.log("BODY", body);
    const dataPaciente = JSON.parse(body);

    const paciente = servicePaciente.editar(id, dataPaciente);

    res.statusCode = 201;
    res.setHeader("ContentType", "application/json");

    res.end(
      JSON.stringify({
        status: "paciente atualizado",
        alterados: paciente.changes,
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

// deletar paciente
export async function deletarPaciente(req, res) {
  const id = Number(req.params.id);

  try {
    const deletePaciente = servicePaciente.deletar(id);

    // se o paciente nao existir
    if (deletePaciente.changes === 0) {
      res.statusCode = 404;

      return res.end(
        JSON.stringify({
          error: "Paciente não encontrado",
        }),
      );
    }

    res.setHeader("Content-Type", "application/json");

    res.end(
      JSON.stringify({
        mensagem: "paciente Deletado!",
        deletado: deletePaciente,
      }),
    );
  } catch (error) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");

    res.end(
      JSON.stringify({
        error: "Erro ao deletar paciente",
      }),
    );
  }
}
