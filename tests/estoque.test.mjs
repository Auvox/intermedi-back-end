import test from "node:test";
import assert from "node:assert/strict";

// Banco em memória com os dados do seed (nunca mexe no banco local)
process.env.INTERMEDI_DB_PATH = ":memory:";
const { default: db } = await import("../database/database.mjs");
const { aplicarSeed } = await import("../database/setup.mjs");
const serviceEstoque = await import("../services/estoque.service.mjs");
const serviceFuncionario = await import("../services/funcionario.service.mjs");
const serviceRemedio = await import("../services/remedio.service.mjs");
aplicarSeed(db);
test.after(() => db.close());

// Seed: gerente 3 (Beatriz) e funcionária 6 (Larissa) são da farmácia 3.
// Gerente 4 é da farmácia 4, onde a Vitamina C (13) está com lote vencido.
const quantidadeNaFarmacia = (idFarmacia, idRemedio) =>
  serviceEstoque.buscarItem(idFarmacia, idRemedio)?.quantidade;

test("lista o estoque da farmácia com situação, resumo e filtros", () => {
  const { farmacia, resumo, estoque } = serviceEstoque.listarDaFarmacia(3);
  assert.equal(farmacia.nomeFarmacia, "Farmácia Saúde Leste");
  assert.equal(resumo.totalItens, 6);

  const amoxicilina = estoque.find((item) => item.idRemedio === 5);
  assert.equal(amoxicilina.situacao, "critico");
  assert.equal(amoxicilina.exigeReceita, true);

  const criticos = serviceEstoque.listarDaFarmacia(3, { situacao: "critico" }).estoque;
  assert.ok(criticos.every((item) => item.critico));
  assert.deepEqual(serviceEstoque.listarDaFarmacia(3, { busca: "amoxi" }).estoque.map((i) => i.idRemedio), [5]);
  assert.equal(serviceEstoque.listarDaFarmacia(4, { situacao: "vencido" }).estoque[0].idRemedio, 13);
  assert.throws(() => serviceEstoque.listarDaFarmacia(3, { situacao: "xyz" }), { status: 400 });
  assert.throws(() => serviceEstoque.listarDaFarmacia(999), { status: 404 });
});

test("gerente só cadastra remédio que existe no catálogo, uma vez por farmácia", () => {
  // Omeprazol (8) não está na farmácia 3
  const item = serviceEstoque.cadastrar(3, { idRemedio: 8, quantidade: "50", estoqueMinimo: 10, validade: "2027-12-31" });
  assert.equal(item.idFarmacia, 3);
  assert.equal(item.quantidade, 50);
  assert.equal(item.idGerenteCadastro, 3);

  assert.throws(() => serviceEstoque.cadastrar(3, { idRemedio: 8, quantidade: 1 }), { status: 409 });
  assert.throws(() => serviceEstoque.cadastrar(3, { idRemedio: 9999, quantidade: 1 }), { status: 404 });
  assert.throws(() => serviceEstoque.cadastrar(3, { idRemedio: 3 }), { status: 400 });
  assert.throws(() => serviceEstoque.cadastrar(3, { idRemedio: 3, quantidade: -1 }), { status: 400 });
  assert.throws(() => serviceEstoque.cadastrar(3, { idRemedio: 3, quantidade: 1, validade: "31/12/2027" }), { status: 400 });
  assert.throws(() => serviceEstoque.cadastrar(999, { idRemedio: 3, quantidade: 1 }), { status: 404 });

  // o admin não consegue apagar do catálogo um remédio que está em estoque
  assert.throws(() => serviceRemedio.deletar(8), { status: 409 });
});

test("gerente ajusta quantidade, registra entrada e remove do estoque", () => {
  serviceEstoque.cadastrar(3, { idRemedio: 3, quantidade: 10 });

  assert.equal(serviceEstoque.editar(3, 3, { entrada: 5 }).quantidade, 15);
  const ajustado = serviceEstoque.editar(3, 3, { quantidade: 40, estoqueMinimo: 5 });
  assert.equal(ajustado.quantidade, 40);
  assert.equal(ajustado.situacao, "ok");
  assert.ok(ajustado.updatedAtEstoque);

  assert.throws(() => serviceEstoque.editar(3, 3, { quantidade: 1, entrada: 1 }), { status: 400 });
  assert.throws(() => serviceEstoque.editar(3, 3, {}), { status: 400 });
  // gerente de outra farmácia não enxerga este item
  assert.equal(serviceEstoque.editar(4, 3, { entrada: 1 }), null);

  assert.equal(serviceEstoque.deletar(3, 3).idRemedio, 3);
  assert.equal(serviceEstoque.buscarItem(3, 3), undefined);
});

const servico = (remedios) => ({ idFuncionario: 6, idPaciente: 1, idFarmacia: 3, remedios });

test("serviço dá baixa no estoque da farmácia e informa quando fica crítico", () => {
  const antes = quantidadeNaFarmacia(3, 2); // Paracetamol
  const { idServico, baixas } = serviceFuncionario.novoServico(servico([{ idRemedio: 2, quantidade: 3 }]));

  assert.ok(idServico);
  assert.equal(quantidadeNaFarmacia(3, 2), antes - 3);
  assert.deepEqual(baixas[0], {
    idRemedio: 2, nomeRemedio: "Paracetamol", quantidadeBaixada: 3,
    estoqueAnterior: antes, estoqueAtual: antes - 3, estoqueMinimo: 50, critico: false,
  });

  const amoxicilina = serviceFuncionario.novoServico(servico([{ idRemedio: 5, quantidade: 2 }])).baixas[0];
  assert.equal(amoxicilina.critico, true);
});

test("sem estoque suficiente, remédio fora do estoque ou vencido: nada é gravado", () => {
  const servicos = () => db.prepare("SELECT COUNT(*) AS n FROM servico").get().n;
  const antes = { servicos: servicos(), paracetamol: quantidadeNaFarmacia(3, 2) };

  // Paracetamol tem estoque, mas Amoxicilina não tem 9999 -> desfaz tudo
  assert.throws(() => serviceFuncionario.novoServico(servico([
    { idRemedio: 2, quantidade: 1 }, { idRemedio: 5, quantidade: 9999 },
  ])), { status: 409, message: /Estoque insuficiente de Amoxicilina/ });
  // Losartana (6) não está no estoque da farmácia 3
  assert.throws(() => serviceFuncionario.novoServico(servico([{ idRemedio: 6, quantidade: 1 }])),
    { status: 409, message: /não está no estoque/ });
  // Vitamina C vencida na farmácia 4 (funcionário 8 é de lá)
  assert.throws(() => serviceFuncionario.novoServico({
    idFuncionario: 8, idPaciente: 1, idFarmacia: 4, remedios: [{ idRemedio: 13, quantidade: 1 }],
  }), { status: 409, message: /venceu/ });

  assert.equal(servicos(), antes.servicos);
  assert.equal(quantidadeNaFarmacia(3, 2), antes.paracetamol);
});

test("detalhe do serviço traz paciente, funcionário e remédios; lista filtra por farmácia", () => {
  const detalhe = serviceFuncionario.buscarServico(1);
  assert.equal(detalhe.nomePaciente, "Maria Santos");
  assert.equal(detalhe.nomeFuncionario, "Lucas Pereira");
  assert.deepEqual(detalhe.remedios.map((r) => [r.nomeRemedio, r.quantidade]), [["Dipirona", 2], ["Paracetamol", 1]]);
  assert.equal(detalhe.quantidadeTotal, 3);
  assert.equal(serviceFuncionario.buscarServico(999999), null);

  const daFarmacia3 = serviceFuncionario.listarServicos(3);
  assert.ok(daFarmacia3.length > 0);
  assert.ok(daFarmacia3.every((s) => s.idFarmacia === 3));
});
