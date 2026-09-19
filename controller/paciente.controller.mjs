import * as servicePaciente from "../services/paciente.service.mjs";
import { enviarErro, enviarJson, erro, idDaUrl, lerJson } from "../utils/http.mjs";

// cadastrar paciente
export async function cadastrarPaciente(req, res) {
  try {
    const data = await lerJson(req);
    const paciente = servicePaciente.cadastrar(data);

    enviarJson(res, 201, {
      status: "CADASTRADO COM SUCESSO - POST",
      recebido: paciente,
    });
  } catch (error) {
    enviarErro(res, error);
  }
}

// listar paciente
export async function consultarPaciente(req, res) {
  try {
    const paciente = servicePaciente.listar();
    enviarJson(res, 200, {
      mensagem: "TODOS OS PACIENTES CADASTRADOS - GET",
      paciente,
    });
  } catch (error) {
    enviarErro(res, error);
  }
}

// buscar paciente por id
export async function buscarPaciente(req, res) {
  try {
    const id = idDaUrl(req, "Paciente");
    const paciente = servicePaciente.buscarPorId(id);
    if (!paciente) throw erro(404, "paciente nao encontrado");

    enviarJson(res, 200, {
      status: "paciente encontrado",
      resultado: paciente,
    });
  } catch (error) {
    enviarErro(res, error);
  }
}

export async function listarOuBuscarPacientes(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    // Captura o parâmetro enviado (?usuario=fe ou ?busca=fe)
    const termo = url.searchParams.get("usuario") || url.searchParams.get("busca") || "";

    if (termo.trim()) {
      const resultados = servicePaciente.buscarPorTermo(termo);
      return res.writeHead(200, { "Content-Type": "application/json" }).end(
        JSON.stringify({
          mensagem: "PACIENTE(S) ENCONTRADO/A(S) - GET",
          paciente: resultados
        })
      );
    }

    const todos = servicePaciente.listar();
    return res.writeHead(200, { "Content-Type": "application/json" }).end(
      JSON.stringify({
        mensagem: "TODOS OS PACIENTES LISTADOS - GET",
        paciente: todos
      })
    );
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" }).end(
      JSON.stringify({ erro: error.message })
    );
  }
}

// editar paciente
export async function editarPaciente(req, res) {
  try {
    const id = idDaUrl(req, "Paciente");
    const data = await lerJson(req);
    const paciente = servicePaciente.editar(id, data);
    if (paciente.changes === 0) throw erro(404, "Paciente não encontrado");

    enviarJson(res, 201, {
      status: "paciente atualizado",
      alterados: paciente.changes,
    });
  } catch (error) {
    enviarErro(res, error);
  }
}

// deletar paciente
export async function deletarPaciente(req, res) {
  try {
    const id = idDaUrl(req, "Paciente");
    const deletado = servicePaciente.deletar(id);
    if (deletado.changes === 0) throw erro(404, "Paciente não encontrado");

    enviarJson(res, 200, {
      mensagem: "Paciente Deletado!",
      deletado,
    });
  } catch (error) {
    enviarErro(res, error);
  }
}
