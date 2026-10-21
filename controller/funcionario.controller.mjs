import * as serviceFuncionario from "../services/funcionario.service.mjs";
import { enviarBoasVindas } from "../services/email.service.mjs";
import { enviarErro, enviarJson, erro, idDaUrl, lerJson } from "../utils/http.mjs";
import { apagarArquivoDaFoto } from "./foto.controller.mjs";

// req.usuario vem do login (services/acesso.service.mjs); sem ele, nada é filtrado
const ehAdmin = (req) => !req.usuario || req.usuario.papel === "admin";

// listar serviços (filtro opcional: GET /servicos?idFarmacia=3)
export function consultarServicos(req, res) {
  try {
    const valor = new URL(req.url ?? "/", "http://localhost").searchParams.get("idFarmacia");
    let idFarmacia = valor ? Number(valor) : null;
    if (valor && (!Number.isSafeInteger(idFarmacia) || idFarmacia <= 0)) {
      throw erro(400, "idFarmacia deve ser um inteiro positivo.");
    }
    // gerente e funcionário só veem os serviços da farmácia deles
    if (!ehAdmin(req)) idFarmacia = req.usuario.idFarmacia;
    enviarJson(res, 200, { servicos: serviceFuncionario.listarServicos(idFarmacia) });
  } catch (error) {
    enviarErro(res, error);
  }
}

// detalhe de um serviço.
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

// cadastrar serviço e seus medicamentos com baixa no estoque
export async function cadastrarServico(req, res) {
  try {
    const data = await lerJson(req);
    // o serviço é sempre da farmácia de quem está logado; o funcionário registra em nome dele
    if (!ehAdmin(req)) data.idFarmacia = req.usuario.idFarmacia;
    if (req.usuario?.papel === "funcionario") data.idFuncionario = req.usuario.id;
    const servico = serviceFuncionario.novoServico(data);
    enviarJson(res, 201, {
      status: "CADASTRADO COM SUCESSO - POST",
      recebido: servico,
    });
  } catch (error) {
    enviarErro(res, error);
    console.log(error);
  }
}

export async function cadastrarServicoFuncionario(req, res) {
  try {
    const data = await lerJson(req);
    const resultado = serviceFuncionario.novoServico(data);

    enviarJson(res, 201, {
      status: "Serviço cadastrado com sucesso e estoque atualizado",
      resultado,
    });
  } catch (error) {
    enviarErro(res, error);
  }
}

// cadastrar funcionario (o gerente cadastra na farmácia dele): gera a
// matrícula e manda o e-mail de boas-vindas
export async function cadastrarFuncionario(req, res) {
  try {
    const data = await lerJson(req);
    if (req.usuario?.papel === "gerente") {
      data.fkIdFarmacia = req.usuario.idFarmacia;
      delete data.idFarmacia;
      data.idGerenteCadastro = req.usuario.id;
    }
    const { senhaProvisoria, ...funcionario } = serviceFuncionario.cadastrar(data);

    const criado = serviceFuncionario.buscarPorId(funcionario.idFuncionario);
    const email = await enviarBoasVindas({
      papel: "funcionario",
      nome: criado.nomeFuncionario,
      email: criado.emailFuncionario,
      cpf: criado.cpfFuncionario,
      matricula: funcionario.matriculaFuncionario,
      senhaProvisoria,
      idFarmacia: funcionario.fkIdFarmacia,
      cadastradoPor: req.usuario?.nome,
    });

    enviarJson(res, 201, {
      status: "CADASTRADO COM SUCESSO - POST",
      recebido: funcionario,
      matricula: funcionario.matriculaFuncionario,
      email,
      // a senha provisória só vai por e-mail; se o envio falhou, quem
      // cadastrou recebe a senha para entregar pessoalmente
      ...(email.status === "falhou" && senhaProvisoria && { senhaProvisoria }),
    });
  } catch (error) {
    enviarErro(res, error);
  }
}

// listar funcionario
export async function consultarFuncionario(req, res) {
  try {
    // o admin vê todos; gerente e funcionário, só os da farmácia deles
    const funcionario = serviceFuncionario.listar()
      .filter((f) => ehAdmin(req) || f.fkIdFarmacia === req.usuario.idFarmacia);
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
    // gerente e o próprio funcionário editam, mas não trocam a farmácia nem a matrícula
    if (!ehAdmin(req)) {
      delete data.fkIdFarmacia;
      delete data.idFarmacia;
      delete data.matriculaFuncionario;
    }
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
    // executa o logout do funcionario
    enviarJson(res, 200, {
      status: "Sessão encerrada com sucesso.",
    });
  } catch (error) {
    enviarErro(res, error);
  }
}