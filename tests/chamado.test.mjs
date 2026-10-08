import test from "node:test";
import assert from "node:assert/strict";

// Banco em memória com os dados do seed (nunca mexe no banco local)
process.env.INTERMEDI_DB_PATH = ":memory:";
process.env.INTERMEDI_TEMPO_ENTREGA_SEGUNDOS = "120";
const { default: db } = await import("../database/database.mjs");
const { aplicarSeed } = await import("../database/setup.mjs");
const serviceChamado = await import("../services/chamado.service.mjs");
const serviceRedistribuicao = await import("../services/redistribuicao.service.mjs");
const serviceEstoque = await import("../services/estoque.service.mjs");
aplicarSeed(db);
test.after(() => db.close());

// Seed:
//   farmácia 1 (gerente 1 Ana, funcionário 1 Lucas)
//   farmácia 2 (gerente 2 Carlos)
//   farmácia 3 (gerente 3 Beatriz, funcionária 6 Larissa)
//   farmácia 4 (gerente 4 Rafael)
// Paracetamol (2): f1 40/min50, f3 180/min50        -> só f3 tem sobra
// Dipirona (1):    f1 120/min30, f2 15/min30, f3 300/min50
const quantidade = (idFarmacia, idRemedio) => serviceEstoque.buscarItem(idFarmacia, idRemedio)?.quantidade ?? 0;
const daquiA = (segundos) =>
  new Date(Date.now() + segundos * 1000).toISOString().replace("T", " ").slice(0, 19);

test("funcionário solicita um remédio ou um pacote: chamado nasce pendente", () => {
  const chamado = serviceChamado.solicitar(6, {
    prioridade: "urgente",
    remedios: [{ idRemedio: 5, quantidade: 100 }, { idRemedio: 9, quantidade: 40 }],
  });

  assert.equal(chamado.status, "pendente");
  assert.equal(chamado.titulo, "Reposição: Amoxicilina, Azitromicina");
  assert.equal(chamado.resposta, null);
  assert.deepEqual(chamado.gerentes.map((g) => g.idGerente), [3]);
  assert.ok(chamado.remedios.every((r) => r.situacao === "aguardando_gerente" && r.pedidoAtual === null));
  assert.deepEqual(
    chamado.remedios.map((r) => [r.idRemedio, r.quantidadeSolicitada, r.estoqueAtual, r.critico]),
    [[5, 100, 8, true], [9, 40, 25, false]],
  );
});

test("solicitação inválida é recusada", () => {
  assert.throws(() => serviceChamado.solicitar(999, { remedios: [{ idRemedio: 5, quantidade: 1 }] }), { status: 404 });
  assert.throws(() => serviceChamado.solicitar(6, { remedios: [] }), { status: 400 });
  assert.throws(() => serviceChamado.solicitar(6, { remedios: [{ idRemedio: 999, quantidade: 1 }] }), { status: 404 });
  assert.throws(() => serviceChamado.solicitar(6, { remedios: [{ idRemedio: 5, quantidade: 0 }] }), { status: 400 });
  assert.throws(() => serviceChamado.solicitar(6, {
    remedios: [{ idRemedio: 5, quantidade: 1 }, { idRemedio: 5, quantidade: 2 }],
  }), { status: 400 });
});

test("gerente vê a disponibilidade na rede antes de aceitar", () => {
  const { idChamado } = serviceChamado.solicitar(1, { remedios: [{ idRemedio: 2, quantidade: 30 }] });
  const { remedios } = serviceChamado.disponibilidade(idChamado, 1);

  const paracetamol = remedios[0];
  assert.equal(paracetamol.temFornecedor, true);
  const f3 = paracetamol.farmacias.find((f) => f.idFarmacia === 3);
  assert.equal(f3.disponivel, 130);
  assert.equal(f3.podeAtender, true);
  assert.ok(paracetamol.farmacias.every((f) => f.idFarmacia !== 1), "não lista a própria farmácia");

  assert.throws(() => serviceChamado.disponibilidade(idChamado, 3), { status: 403 });
  assert.throws(() => serviceChamado.disponibilidade(idChamado, undefined), { status: 400 });
});

test("fluxo completo: aceita -> fornecedor aceita -> estoque sai na hora e entra após o tempo de entrega", () => {
  const { idChamado } = serviceChamado.solicitar(1, { remedios: [{ idRemedio: 2, quantidade: 30 }] });
  const antes = { f1: quantidade(1, 2), f3: quantidade(3, 2) };

  // gerente da farmácia 1 aceita: pedido vai para a farmácia 3
  const { chamado, despacho } = serviceChamado.responder(idChamado, { idGerente: 1, aceitar: true, nomeGerenteConfirmacao: "Ana Souza" });
  assert.equal(chamado.status, "em_andamento");
  assert.equal(despacho[0].enviadoPara.idFarmacia, 3);
  assert.equal(chamado.remedios[0].situacao, "aguardando_fornecedor");

  // gerente da farmácia 3 recebe a notificação
  const caixa = serviceRedistribuicao.listarDoGerente(3, { tipo: "recebidos", status: "solicitada" });
  const pedido = caixa.pedidos.find((p) => p.idRedistribuicao === despacho[0].idRedistribuicao);
  assert.ok(caixa.totalPendentes >= 1);
  assert.match(pedido.mensagem, /Ana Souza \(Farmácia Pedro João Neto\) está precisando de 30× Paracetamol/);

  // outra farmácia não pode responder
  assert.throws(() => serviceRedistribuicao.responder(pedido.idRedistribuicao, { idGerente: 4, aceitar: true }), { status: 403 });

  // aceita: sai do estoque da farmácia 3 na hora; farmácia 1 ainda não recebeu
  const aceito = serviceRedistribuicao.responder(pedido.idRedistribuicao, { idGerente: 3, aceitar: true });
  assert.equal(aceito.pedido.status, "enviada");
  assert.ok(aceito.pedido.segundosParaChegar > 100 && aceito.pedido.segundosParaChegar <= 120);
  assert.equal(quantidade(3, 2), antes.f3 - 30);
  assert.equal(quantidade(1, 2), antes.f1);
  assert.equal(serviceChamado.buscarPorId(idChamado).remedios[0].situacao, "a_caminho");
  assert.throws(() => serviceRedistribuicao.responder(pedido.idRedistribuicao, { idGerente: 3, aceitar: true }), { status: 409 });

  // antes do prazo nada chega; depois do prazo entra no estoque e o chamado resolve
  assert.equal(serviceRedistribuicao.processarChegadas(daquiA(60)), 0);
  assert.equal(serviceRedistribuicao.processarChegadas(daquiA(121)), 1);
  assert.equal(quantidade(1, 2), antes.f1 + 30);
  const resolvido = serviceChamado.buscarPorId(idChamado);
  assert.equal(resolvido.status, "resolvido");
  assert.equal(resolvido.remedios[0].situacao, "recebido");
});

test("recusa do fornecedor repassa sozinho para a próxima farmácia que tem o remédio", () => {
  // Dipirona 40 para a farmácia 2: sobra em f3 (250) e f1 (90)
  const { idChamado } = serviceChamado.solicitar(2, { remedios: [{ idRemedio: 1, quantidade: 40 }] });
  const { despacho } = serviceChamado.responder(idChamado, { idGerente: 2, aceitar: true, nomeGerenteConfirmacao: "Carlos Lima" });
  assert.equal(despacho[0].enviadoPara.idFarmacia, 3);

  const recusa = serviceRedistribuicao.responder(despacho[0].idRedistribuicao,
    { idGerente: 3, aceitar: false, motivo: "Reservado para campanha" });
  assert.equal(recusa.pedido.status, "recusada");
  assert.equal(recusa.encaminhadoPara.idFarmacia, 1);

  // f1 também recusa: ninguém mais tem -> item fica sem fornecedor
  const segunda = serviceRedistribuicao.responder(recusa.encaminhadoPara.idRedistribuicao, { idGerente: 1, aceitar: false });
  assert.equal(segunda.encaminhadoPara, null);

  const chamado = serviceChamado.buscarPorId(idChamado);
  assert.equal(chamado.remedios[0].situacao, "sem_fornecedor");
  assert.equal(chamado.pedidos.length, 2);
  // tentar de novo não manda para quem já recusou
  assert.equal(serviceChamado.redistribuir(idChamado, 2).despacho[0].enviadoPara, null);
});

test("pacote: prefere a farmácia que atende mais itens; item que ninguém tem fica sem fornecedor", () => {
  // Paracetamol só f3 tem sobra; Dipirona f3 e f1 -> os dois vão para f3.
  // Simeticona (14) só existe zerada na f2 -> sem fornecedor.
  const { idChamado } = serviceChamado.solicitar(1, { remedios: [
    { idRemedio: 2, quantidade: 10 }, { idRemedio: 1, quantidade: 10 }, { idRemedio: 14, quantidade: 5 },
  ] });
  const { chamado, despacho } = serviceChamado.responder(idChamado, { idGerente: 1, aceitar: true, nomeGerenteConfirmacao: "Ana Souza" });

  const para = Object.fromEntries(despacho.map((d) => [d.idRemedio, d.enviadoPara?.idFarmacia ?? null]));
  assert.deepEqual(para, { 1: 3, 2: 3, 14: null });
  assert.equal(chamado.remedios.find((r) => r.idRemedio === 14).situacao, "sem_fornecedor");
});

test("gerente recusa chamado exige motivo; não responde duas vezes", () => {
  const { idChamado } = serviceChamado.solicitar(6, { remedios: [{ idRemedio: 5, quantidade: 1 }] });
  assert.throws(() => serviceChamado.responder(idChamado, { idGerente: 3, aceitar: false }), { status: 400 });
  assert.throws(() => serviceChamado.responder(idChamado, { idGerente: 1, aceitar: true, nomeGerenteConfirmacao: "Ana Souza" }), { status: 403 });

  const { chamado, despacho } = serviceChamado.responder(idChamado, { idGerente: 3, aceitar: false, resposta: "Sem verba" });
  assert.equal(chamado.status, "recusado");
  assert.deepEqual(despacho, []);
  assert.equal(chamado.remedios[0].situacao, null);
  assert.throws(() => serviceChamado.responder(idChamado, { idGerente: 3, aceitar: true }), { status: 409 });
  assert.ok(serviceChamado.listarDoFuncionario(6, "recusado").some((c) => c.idChamado === idChamado));
});

test("fornecedor sem estoque suficiente não consegue aceitar", () => {
  // Amoxicilina 60 pedida à f2 no seed (pedido 3); f2 tem 90 -> baixa para 30 e tenta de novo
  serviceEstoque.editar(2, 5, { quantidade: 30 });
  assert.throws(() => serviceRedistribuicao.responder(3, { idGerente: 2, aceitar: true }),
    { status: 409, message: /não tem 60 unidades/ });
});

test("filtros inválidos são recusados", () => {
  assert.throws(() => serviceChamado.listarDoGerente(3, "xyz"), { status: 400 });
  assert.throws(() => serviceRedistribuicao.listarDoGerente(3, { tipo: "xyz" }), { status: 400 });
  assert.throws(() => serviceRedistribuicao.listarDoGerente(999, {}), { status: 404 });
});

test("aceite exige nome do gerente salvo no banco e falhas não alteram chamado nem pedidos", () => {
  const { idChamado } = serviceChamado.solicitar(1, { remedios: [{ idRemedio: 2, quantidade: 1 }] });
  const antes = db.prepare("SELECT * FROM chamado WHERE id_chamado = ?").get(idChamado);
  const pedidosAntes = db.prepare("SELECT COUNT(*) AS n FROM redistribuicao").get().n;
  for (const nomeGerenteConfirmacao of [undefined, null, "", "   ", 1, {}, "Ana", "ana souza", "Carlos Lima", "Fernanda Costa"]) {
    assert.throws(() => serviceChamado.responder(idChamado, {
      idGerente: 1, aceitar: true, nomeGerenteConfirmacao,
    }), { status: 400 });
    assert.deepEqual(db.prepare("SELECT * FROM chamado WHERE id_chamado = ?").get(idChamado), antes);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM redistribuicao").get().n, pedidosAntes);
  }
  const resultado = serviceChamado.responder(idChamado, {
    idGerente: 1, aceitar: true, nomeGerenteConfirmacao: "  Ana Souza  ",
  });
  assert.equal(resultado.chamado.status, "em_andamento");
  assert.equal(resultado.chamado.resposta.idGerente, 1);
  assert.throws(() => serviceChamado.responder(idChamado, {
    idGerente: 1, aceitar: true, nomeGerenteConfirmacao: "Ana Souza",
  }), { status: 409 });
});

test("rota HTTP bloqueia aceite sem confirmação e permite nome correto", async () => {
  const { Readable } = await import("node:stream");
  const { responderChamado } = await import("../controller/chamado.controller.mjs");
  const { idChamado } = serviceChamado.solicitar(1, { remedios: [{ idRemedio: 2, quantidade: 1 }] });
  async function request(body) {
    const req = Readable.from([Buffer.from(JSON.stringify(body))]);
    req.params = { id: String(idChamado) };
    const res = { setHeader() {}, end(body) { this.body = JSON.parse(body); } };
    await responderChamado(req, res);
    return res;
  }
  assert.equal((await request({ idGerente: 1, aceitar: true })).statusCode, 400);
  const res = await request({ idGerente: 1, aceitar: true, nomeGerenteConfirmacao: "Ana Souza" });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.chamado.status, "em_andamento");
});