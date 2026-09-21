import * as serviceFuncionario from "../services/funcionario.service.mjs";
import { enviarErro, enviarJson, erro, idDaUrl, lerJson } from "../utils/http.mjs";

// cadastrar funcionario
export async function cadastrarFuncionario(req, res) {
  try {
    const data = await lerJson(req);
    const funcionario = serviceFuncionario.cadastrar(data);

    enviarJson(res, 201, {
      status: "CADASTRADO COM SUCESSO - POST",
      recebido: funcionario,
      matricula: funcionario.matriculaFuncionario,
      // só vem preenchida quando o cadastro não informou senhaFuncionario
      senhaProvisoria: funcionario.senhaProvisoria,
    });
  } catch (error) {
    enviarErro(res, error);
  }
}

// listar funcionario
export async function consultarFuncionario(req, res) {
  try {
    const funcionario = serviceFuncionario.listar();
    enviarJson(res, 200, {
      mensagem: "TODOS OS FUNCIONARIOS CADASTRADOS - GET",
      funcionario,
    });
  } catch (error) {
    enviarErro(res, error);
  }
}

// buscar funcionario por id
export async function buscarFuncionario(req, res) {
  try {
    const id = idDaUrl(req, "Funcionario");
    const funcionario = serviceFuncionario.buscarPorId(id);
    if (!funcionario) throw erro(404, "funcionario nao encontrado");

    enviarJson(res, 200, {
      status: "funcionario encontrado",
      resultado: funcionario,
    });
  } catch (error) {
    enviarErro(res, error);
  }
}

// editar funcionario
export async function editarFuncionario(req, res) {
  try {
    const id = idDaUrl(req, "Funcionario");
    const data = await lerJson(req);
    const funcionario = serviceFuncionario.editar(id, data);
    if (funcionario.changes === 0) throw erro(404, "Funcionario não encontrado");

    enviarJson(res, 201, {
      status: "funcionario atualizado",
      alterados: funcionario.changes,
    });
  } catch (error) {
    enviarErro(res, error);
  }
}

// deletar funcionario
export async function deletarFuncionario(req, res) {
  try {
    const id = idDaUrl(req, "Funcionario");
    const deletado = serviceFuncionario.deletar(id);
    if (deletado.changes === 0) throw erro(404, "Funcionario não encontrado");

    enviarJson(res, 200, {
      mensagem: "Funcionario Deletado!",
      deletado,
    });
  } catch (error) {
    enviarErro(res, error);
  }
}
