import db from "../database/database.mjs";
import { erro } from "../utils/http.mjs";
import { autenticar, tokenDaRequisicao } from "./auth.service.mjs";

// Quem pode chamar cada rota da API.
// O server.mjs chama autorizar() antes do controller; ele confere o JWT,
// guarda a pessoa em req.usuario e aplica a regra da rota:
//   • PUBLICO: não precisa de login
//   • qualquer outra regra: precisa de login; o admin passa sempre
//   • rota sem regra aqui: só o admin (rota nova sem regra fica fechada)
// Os controllers ainda forçam os ids do corpo (idGerente, idFuncionario,
// farmácia) para os da pessoa logada.

const PUBLICO = "publico";

// --- farmácia de cada registro (undefined = registro não existe -> o controller responde 404)
const umaFarmacia = (sql) => (id) => {
  const linha = db.prepare(sql).get(id);
  return linha ? [linha.f] : undefined;
};
const FARMACIAS = {
  gerente: umaFarmacia("SELECT id_farmacia AS f FROM gerente WHERE id_gerente = ?"),
  funcionario: umaFarmacia("SELECT id_farmacia AS f FROM funcionario WHERE id_funcionario = ?"),
  farmacia: umaFarmacia("SELECT id_farmacia AS f FROM farmacia WHERE id_farmacia = ?"),
  servico: umaFarmacia("SELECT id_farmacia AS f FROM servico WHERE id_servico = ?"),
  chamado: umaFarmacia("SELECT id_farmacia AS f FROM chamado WHERE id_chamado = ?"),
  // farmácia que recebe o pedido (fornecedora)
  origem: umaFarmacia("SELECT id_farmacia_origem AS f FROM redistribuicao WHERE id_redistribuicao = ?"),
  // as duas pontas do pedido
  redistribuicao: (id) => {
    const linha = db.prepare(/*sql*/ `
      SELECT id_farmacia_origem AS origem, id_farmacia_destino AS destino
      FROM redistribuicao WHERE id_redistribuicao = ?
    `).get(id);
    return linha ? [linha.origem, linha.destino] : undefined;
  },
  // a farmácia do chamado e as que receberam pedidos dele
  chamadoNaRede: (id) => {
    const chamado = db.prepare("SELECT id_farmacia AS f FROM chamado WHERE id_chamado = ?").get(id);
    if (!chamado) return undefined;
    const fornecedoras = db.prepare("SELECT DISTINCT id_farmacia_origem AS f FROM redistribuicao WHERE id_chamado = ?")
      .all(id).map((linha) => linha.f);
    return [chamado.f, ...fornecedoras];
  },
};

// --- regras: (usuario, params) => true/false
const logado = () => true;
const papel = (...papeis) => (usuario) => papeis.includes(usuario.papel);
const todas = (...regras) => (usuario, params) => regras.every((regra) => regra(usuario, params));
const alguma = (...regras) => (usuario, params) => regras.some((regra) => regra(usuario, params));
// a pessoa da URL é quem está logado
const eu = (tipo) => (usuario, params) => usuario.papel === tipo && usuario.id === Number(params.id);
// o registro da URL pertence à farmácia de quem está logado
const daFarmacia = (tipo) => (usuario, params) => {
  const id = Number(params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return true; // o controller responde 404
  const farmacias = FARMACIAS[tipo](id);
  return farmacias === undefined || farmacias.includes(usuario.idFarmacia);
};

const gerenteDaFarmacia = (tipo) => todas(papel("gerente"), daFarmacia(tipo));
const ADMIN = () => false; // o admin passa antes de chegar na regra
const editarFuncionario = alguma(eu("funcionario"), gerenteDaFarmacia("funcionario"));

const REGRAS = {
  // login da equipe
  "POST /auth/login": PUBLICO,
  "POST /auth/logout": PUBLICO, // encerra a sessão do token, se ele for válido
  "GET /auth/me": logado,

  // app do paciente: tem o próprio login (routes/app.routes.mjs)
  "POST /api/auth/register": PUBLICO,
  "POST /api/auth/login": PUBLICO,
  "POST /api/auth/logout": PUBLICO,
  "GET /api/pacientes/me": PUBLICO,
  "PUT /api/pacientes/me": PUBLICO,
  "DELETE /api/pacientes/me": PUBLICO,
  "PUT /api/pacientes/:id/foto": PUBLICO,

  // imagens: a tag <img> não manda o token
  "GET /uploads/perfis/:file": PUBLICO,
  "GET /uploads/fotos/:arquivo": PUBLICO,
  "GET /uploads/remedios/:arquivo": PUBLICO,

  // catálogo e farmácias da rede (informação pública)
  "GET /remedios": PUBLICO,
  "GET /remedios/:id": PUBLICO,
  "GET /categorias": PUBLICO,
  "GET /farmacia": PUBLICO,
  "GET /farmacia/:id": PUBLICO,

  // só o admin
  "POST /farmacia": ADMIN,
  "DELETE /farmacia/:id": ADMIN,
  "POST /gerente": ADMIN,
  "DELETE /gerente/:id": ADMIN,
  "POST /remedios": ADMIN,
  "PUT /remedios/:id": ADMIN,
  "DELETE /remedios/:id": ADMIN,
  "PUT /remedios/:id/foto": ADMIN,
  "DELETE /remedios/:id/foto": ADMIN,

  // farmácia
  "PUT /farmacia/:id": gerenteDaFarmacia("farmacia"),
  "PUT /farmacia/:id/foto": gerenteDaFarmacia("farmacia"),
  "DELETE /farmacia/:id/foto": gerenteDaFarmacia("farmacia"),
  "GET /farmacia/:id/estoque": logado, // estoque da rede
  "GET /farmacia/:id/resumo": logado,

  // gerente
  "GET /gerente": logado, // o controller filtra pela farmácia de quem pede
  "GET /gerente/:id": daFarmacia("gerente"),
  "PUT /gerente/:id": eu("gerente"),
  "PUT /gerente/:id/foto": eu("gerente"),
  "DELETE /gerente/:id/foto": eu("gerente"),
  "GET /gerente/:id/resumo": daFarmacia("gerente"),
  "GET /gerente/:id/estoque": daFarmacia("gerente"),
  "POST /gerente/:id/estoque": gerenteDaFarmacia("gerente"),
  "PUT /gerente/:id/estoque/:idRemedio": gerenteDaFarmacia("gerente"),
  "DELETE /gerente/:id/estoque/:idRemedio": gerenteDaFarmacia("gerente"),
  "GET /gerente/:id/chamados": daFarmacia("gerente"),
  "GET /gerente/:id/redistribuicoes": daFarmacia("gerente"),

  // funcionário
  "POST /funcionario": papel("gerente"), // o controller usa a farmácia do gerente
  "GET /funcionario": logado, // o controller filtra pela farmácia de quem pede
  "GET /funcionario/:id": daFarmacia("funcionario"),
  "PUT /funcionario/:id": editarFuncionario,
  "DELETE /funcionario/:id": gerenteDaFarmacia("funcionario"),
  "PUT /funcionario/:id/foto": editarFuncionario,
  "DELETE /funcionario/:id/foto": editarFuncionario,
  "GET /funcionario/:id/resumo": daFarmacia("funcionario"),
  "POST /funcionario/:id/chamado": eu("funcionario"),
  "GET /funcionario/:id/chamados": daFarmacia("funcionario"),
  "GET /funcionario/:id/preparos": daFarmacia("funcionario"),

  // chamados
  "GET /chamado/:id": daFarmacia("chamadoNaRede"),
  "GET /chamado/:id/disponibilidade": gerenteDaFarmacia("chamado"),
  "PUT /chamado/:id/responder": gerenteDaFarmacia("chamado"),
  "POST /chamado/:id/redistribuir": gerenteDaFarmacia("chamado"),

  // pedidos entre farmácias
  "GET /redistribuicao/:id": daFarmacia("redistribuicao"),
  "PUT /redistribuicao/:id/responder": gerenteDaFarmacia("origem"),
  "POST /redistribuicao/:id/preparar": todas(papel("funcionario"), daFarmacia("origem")),

  // serviços (o controller usa a farmácia de quem está logado)
  "POST /servicos": papel("funcionario", "gerente"),
  "GET /servicos": logado,
  "GET /servicos/:id": daFarmacia("servico"),

  // pacientes: atendidos em qualquer farmácia da rede
  "GET /paciente": logado,
  "POST /paciente": logado,
  "GET /paciente/:id": logado,
  "PUT /paciente/:id": logado,
  "DELETE /paciente/:id": papel("gerente"),
  "GET /paciente/:id/resumo": logado,

  "GET /remedios/:id/resumo": logado,
  "POST /rotas": logado,
};

// Confere o acesso da rota "MÉTODO /rota/:param" (como foi cadastrada no Router).
// Preenche req.usuario quando há login. Lança 401 (sem login) ou 403 (sem permissão).
export function autorizar(req, chave, params = {}) {
  const regra = REGRAS[chave];
  if (regra === PUBLICO) return;

  const sessao = autenticar(tokenDaRequisicao(req));
  if (!sessao) throw erro(401, "Faça login para continuar.");
  req.usuario = sessao.usuario;
  req.sessao = { jti: sessao.jti };

  if (sessao.usuario.papel === "admin") return;
  if (!regra || !regra(sessao.usuario, params)) {
    throw erro(403, "Seu perfil não tem acesso a este recurso.");
  }
}

// Usado no logout: lê o token sem exigir login
export function sessaoOpcional(req) {
  return autenticar(tokenDaRequisicao(req));
}
