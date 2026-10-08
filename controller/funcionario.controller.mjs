import * as serviceFuncionario from "../services/funcionario.service.mjs";
import { enviarErro, enviarJson, erro, idDaUrl, lerJson } from "../utils/http.mjs";
import { apagarArquivoDaFoto } from "./foto.controller.mjs";

// listar serviços (filtro opcional: GET /servicos?idFarmacia=3)
export function consultarServicos(req, res) {
  try {
    const valor = new URL(req.url ?? "/", "http://localhost").searchParams.get("idFarmacia");
    const idFarmacia = valor ? Number(valor) : null;
    if (valor && (!Number.isSafeInteger(idFarmacia) || idFarmacia <= 0)) {
      throw erro(400, "idFarmacia deve ser um inteiro positivo.");
    }
    enviarJson(res, 200, { servicos: serviceFuncionario.listarServicos(idFarmacia) });
  } catch (error) {
    enviarErro(res, error);
  }
}

// detalhe de um serviço
export function buscarServico(req, res) {
  try {
    const id = idDaUrl(req, "Serviço");
    const servico = serviceFuncionario.buscarServico(id);
    if (!servico) throw erro(404, "Serviço não encontrado");

    enviarJson(res, 200, { status: "Servico encontrado", resultado: servico });
  } catch (error) {
    enviarErro(res, error);
  }
}

// cadastrar serviço e seus medicamentos
export async function cadastrarServico(req, res) {
  try {
    const data = await lerJson(req);
    const servico = serviceFuncionario.novoServico(data);
    enviarJson(res, 201, {
      status: "CADASTRADO COM SUCESSO - POST",
      recebido: servico,
    });
  } catch (error) {
    enviarErro(res, error);

    console.log(error)
  }
}

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
    const foto = serviceFuncionario.buscarPorId(id)?.fotoFuncionario;
    const deletado = serviceFuncionario.deletar(id);
    if (deletado.changes === 0) throw erro(404, "Funcionario não encontrado");
    await apagarArquivoDaFoto(foto);

    enviarJson(res, 200, {
      mensagem: "Funcionario Deletado!",
      deletado,
    });
  } catch (error) {
    enviarErro(res, error);
  }
}

export async function logoutFuncionario(req, res) {
  try {
    // executa o logout do gerente
    enviarJson(res, 200, {
      status: "Sessão encerrada com sucesso.",
    });
  } catch (error) {
    enviarErro(res, error);
  }
}
