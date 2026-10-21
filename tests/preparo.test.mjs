import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

// Preparo do pedido pela farmácia fornecedora: aceito -> preparando -> enviada.
// Banco em memória com os dados do seed (nunca mexe no banco local)
process.env.INTERMEDI_DB_PATH = ":memory:";
process.env.INTERMEDI_TEMPO_ENTREGA_SEGUNDOS = "120";
const { default: db } = await import("../database/database.mjs");
const { abrirBanco, aplicarSchema, aplicarSeed } = await import("../database/setup.mjs");
const serviceChamado = await import("../services/chamado.service.mjs");
const serviceRedistribuicao = await import("../services/redistribuicao.service.mjs");
aplicarSeed(db);
test.after(() => db.close());

const daquiA = (segundos) =>
  new Date(Date.now() + segundos * 1000).toISOString().replace("T", " ").slice(0, 19);

// Chamado da farmácia 2 já aceito pelo gerente dela e pelo gerente fornecedor
function pedidoAprovado(quantidade) {
  const { idChamado } = serviceChamado.solicitar(2, { remedios: [{ idRemedio: 1, quantidade }] });
  const { despacho } = serviceChamado.responder(idChamado, { idGerente: 2, aceitar: true, nomeGerenteConfirmacao: "Carlos Lima" });
  const { idRedistribuicao, enviadoPara } = despacho[0];
  assert.ok(enviadoPara, "alguma farmácia tem o remédio sobrando");
  const { id_gerente: idGerente } = db.prepare("SELECT id_gerente FROM gerente WHERE id_farmacia = ? ORDER BY id_gerente")
    .get(enviadoPara.idFarmacia);
  const { pedido } = serviceRedistribuicao.responder(idRedistribuicao, { idGerente, aceitar: true });
  const equipe = db.prepare("SELECT id_funcionario AS id, nome FROM funcionario WHERE id_farmacia = ? ORDER BY id_funcionario")
    .all(enviadoPara.idFarmacia);
  const deFora = db.prepare("SELECT id_funcionario AS id FROM funcionario WHERE id_farmacia <> ? LIMIT 1")
    .get(enviadoPara.idFarmacia);
  return { idChamado, idRedistribuicao, pedido, equipe, deFora };
}

test("aceite do gerente fornecedor deixa o pedido aguardando preparo e avisa toda a equipe", () => {
  const { idChamado, idRedistribuicao, pedido, equipe } = pedidoAprovado(30);
  assert.equal(pedido.status, "aprovada");
  assert.equal(pedido.dataEnvio, null);
  assert.equal(pedido.mensagemPreparo, "Prepare 30× Dipirona 500mg para a Farmácia Vida");
  assert.equal(serviceChamado.buscarPorId(idChamado).remedios[0].situacao, "aguardando_fornecedor");

  assert.ok(equipe.length >= 2, "o seed tem mais de um funcionário por farmácia");
  for (const pessoa of equipe) {
    const aviso = serviceRedistribuicao.listarPreparosDoFuncionario(pessoa.id).pedidos
      .find((p) => p.idRedistribuicao === idRedistribuicao);
    assert.equal(aviso.status, "aprovada");
    assert.equal(aviso.voce, false);
  }
});

test("só o primeiro funcionário assume o preparo; os outros veem quem aceitou", () => {
  const { idChamado, idRedistribuicao, equipe: [primeira, segundo], deFora } = pedidoAprovado(120);

  assert.throws(() => serviceRedistribuicao.iniciarPreparo(idRedistribuicao, {}), { status: 400 });
  assert.throws(() => serviceRedistribuicao.iniciarPreparo(idRedistribuicao, { idFuncionario: deFora.id }), { status: 403 });

  const preparo = serviceRedistribuicao.iniciarPreparo(idRedistribuicao, { idFuncionario: primeira.id });
  assert.equal(preparo.status, "preparando");
  assert.equal(preparo.nomeFuncionarioPreparo, primeira.nome);
  // 120 unidades = 3 caixas de 50 = 3 viagens de 5 s
  assert.equal(preparo.caixas, 3);
  assert.equal(preparo.segundosPreparo, 15);
  assert.ok(preparo.segundosParaChegar > 130 && preparo.segundosParaChegar <= 135);
  assert.equal(serviceChamado.buscarPorId(idChamado).remedios[0].situacao, "em_preparo");

  assert.throws(
    () => serviceRedistribuicao.iniciarPreparo(idRedistribuicao, { idFuncionario: segundo.id }),
    (error) => error.status === 409 && error.message === `${primeira.nome} já aceitou o preparo deste pedido.` &&
      error.dados.preparadoPor.idFuncionario === primeira.id,
  );
  assert.throws(() => serviceRedistribuicao.iniciarPreparo(idRedistribuicao, { idFuncionario: primeira.id }), { status: 409 });

  const avisoDoSegundo = serviceRedistribuicao.listarPreparosDoFuncionario(segundo.id).pedidos
    .find((p) => p.idRedistribuicao === idRedistribuicao);
  assert.equal(avisoDoSegundo.nomeFuncionarioPreparo, primeira.nome);
  assert.equal(avisoDoSegundo.voce, false);
  assert.equal(serviceRedistribuicao.listarPreparosDoFuncionario(primeira.id).pedidos
    .find((p) => p.idRedistribuicao === idRedistribuicao).voce, true);
});

test("caminhão sai quando o preparo termina e o remédio chega depois do tempo de entrega", () => {
  const { idChamado, idRedistribuicao, equipe: [quemPrepara] } = pedidoAprovado(30);
  serviceRedistribuicao.iniciarPreparo(idRedistribuicao, { idFuncionario: quemPrepara.id });

  // 30 unidades = 1 caixa = 5 s de preparo
  assert.equal(serviceRedistribuicao.processarChegadas(daquiA(3)), 0);
  assert.equal(db.prepare("SELECT status FROM redistribuicao WHERE id_redistribuicao = ?").get(idRedistribuicao).status, "preparando");
  assert.equal(serviceRedistribuicao.processarChegadas(daquiA(6)), 0);
  assert.equal(db.prepare("SELECT status FROM redistribuicao WHERE id_redistribuicao = ?").get(idRedistribuicao).status, "enviada");
  assert.equal(serviceChamado.buscarPorId(idChamado).remedios[0].situacao, "a_caminho");

  assert.equal(serviceRedistribuicao.processarChegadas(daquiA(126)), 1);
  const chamado = serviceChamado.buscarPorId(idChamado);
  assert.equal(chamado.status, "resolvido");
  assert.equal(chamado.remedios[0].situacao, "recebido");
});

test("cliques simultâneos pela API: só uma requisição assume o preparo", async (t) => {
  // banco próprio com o seed, num arquivo, para o servidor de verdade usar
  const temp = await mkdtemp(path.join(tmpdir(), "intermedi-preparo-"));
  const dbPath = path.join(temp, "teste.db");
  const banco = abrirBanco(dbPath);
  aplicarSchema(banco);
  aplicarSeed(banco);
  banco.close();

  const env = { ...process.env, INTERMEDI_DB_PATH: dbPath, INTERMEDI_UPLOAD_DIR: path.join(temp, "uploads"), PORT: "0", HOST: "127.0.0.1", INTERMEDI_EXIGIR_LOGIN: "true" };
  const servidor = spawn(process.execPath, [fileURLToPath(new URL("../server.mjs", import.meta.url))], { cwd: temp, env, stdio: ["ignore", "pipe", "pipe"] });
  t.after(async () => {
    if (servidor.exitCode === null) {
      const saiu = once(servidor, "exit");
      servidor.kill();
      await saiu;
    }
    await rm(temp, { recursive: true, force: true });
  });
  const url = await new Promise((resolve, reject) => {
    let saida = "";
    const timer = setTimeout(() => reject(new Error("Servidor não iniciou")), 10000);
    servidor.stdout.on("data", (parte) => {
      saida += parte;
      const achou = saida.match(/Servidor: http:\/\/localhost:(\d+)/);
      if (achou) { clearTimeout(timer); resolve(`http://127.0.0.1:${achou[1]}`); }
    });
  });
  // as rotas exigem login da equipe: usa o admin do seed (CPF + matrícula + senha)
  let token;
  const api = async (rota, method = "GET", corpo) => {
    const resposta = await fetch(url + rota, {
      method, body: corpo && JSON.stringify(corpo),
      headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
    });
    return { status: resposta.status, dados: await resposta.json() };
  };
  ({ dados: { token } } = await api("/auth/login", "POST", { cpf: "999.999.999-99", matricula: "A000001", senha: "senha123" }));
  assert.ok(token);

  const { dados: { chamado: { idChamado } } } = await api("/funcionario/2/chamado", "POST", { remedios: [{ idRemedio: 1, quantidade: 50 }] });
  const { dados: { despacho } } = await api(`/chamado/${idChamado}/responder`, "PUT", { idGerente: 2, aceitar: true, nomeGerenteConfirmacao: "Carlos Lima" });
  const { idRedistribuicao, enviadoPara } = despacho[0];
  const gerentes = (await api("/gerente")).dados.gerente;
  const idGerente = gerentes.find((g) => Number(g.fkIdFarmacia) === enviadoPara.idFarmacia).idGerente;
  assert.equal((await api(`/redistribuicao/${idRedistribuicao}/responder`, "PUT", { idGerente, aceitar: true })).status, 200);

  const equipe = (await api("/funcionario")).dados.funcionario
    .filter((f) => Number(f.fkIdFarmacia) === enviadoPara.idFarmacia).map((f) => f.idFuncionario);
  assert.ok(equipe.length >= 2);
  // 6 cliques ao mesmo tempo (3 de cada funcionário)
  const respostas = await Promise.all([...equipe, ...equipe, ...equipe].slice(0, 6).map((idFuncionario) =>
    api(`/redistribuicao/${idRedistribuicao}/preparar`, "POST", { idFuncionario })));

  const aceitas = respostas.filter((r) => r.status === 200);
  const recusadas = respostas.filter((r) => r.status === 409);
  assert.equal(aceitas.length, 1, "exatamente um clique assume o preparo");
  assert.equal(recusadas.length, 5);
  const vencedor = aceitas[0].dados.pedido.idFuncionarioPreparo;
  assert.ok(recusadas.every((r) => r.dados.pedido.idFuncionarioPreparo === vencedor));
  assert.ok(recusadas.filter((r) => r.dados.preparadoPor).every((r) => r.dados.preparadoPor.idFuncionario === vencedor));
});
