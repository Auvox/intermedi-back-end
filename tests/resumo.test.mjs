import test from "node:test";
import assert from "node:assert/strict";

// Banco em memória com os dados do seed (nunca mexe no banco local)
process.env.INTERMEDI_DB_PATH = ":memory:";
const { default: db } = await import("../database/database.mjs");
const { aplicarSeed } = await import("../database/setup.mjs");
const serviceResumo = await import("../services/resumo.service.mjs");
const { lerPeriodo, serieCompleta } = await import("../utils/periodo.mjs");
aplicarSeed(db);
test.after(() => db.close());

const periodo = (query) => lerPeriodo({ url: `/x?${query}` });
// O seed tem datas de setembro/2026: usa um intervalo fixo para o teste não depender de "hoje"
const SETEMBRO = periodo("de=2026-09-01&ate=2026-09-30");

test("lerPeriodo: padrão 30 dias, atalhos, intervalo personalizado e período anterior", () => {
  const padrao = periodo("");
  assert.equal(padrao.dias, 30);
  assert.equal(padrao.agrupamento, "dia");
  assert.equal(periodo("periodo=12m").agrupamento, "mes");

  assert.deepEqual([SETEMBRO.de, SETEMBRO.ate, SETEMBRO.dias], ["2026-09-01", "2026-09-30", 30]);
  assert.deepEqual(SETEMBRO.anterior, { de: "2026-08-02", ate: "2026-08-31" });

  assert.throws(() => periodo("periodo=5d"), { status: 400 });
  assert.throws(() => periodo("de=2026-02-30"), { status: 400 });
  assert.throws(() => periodo("de=2026-09-10&ate=2026-09-01"), { status: 400 });
});

test("serieCompleta preenche dias e meses sem movimento com zero", () => {
  const dias = serieCompleta(periodo("de=2026-09-01&ate=2026-09-03"), [{ periodo: "2026-09-02", total: 4 }]);
  assert.deepEqual(dias, [
    { periodo: "2026-09-01", total: 0 }, { periodo: "2026-09-02", total: 4 }, { periodo: "2026-09-03", total: 0 },
  ]);
  const meses = serieCompleta(periodo("de=2025-11-15&ate=2026-02-01"), []);
  assert.deepEqual(meses.map((m) => m.periodo), ["2025-11", "2025-12", "2026-01", "2026-02"]);
});

test("resumo do funcionário: serviços, chamados, top remédios e totais", () => {
  // Lucas (1): serviços 1 (Dipirona 2 + Paracetamol 1) e 7 (Losartana 1 + Vitamina C 1); chamado 1
  const resumo = serviceResumo.funcionario(1, SETEMBRO);
  assert.equal(resumo.funcionario.nomeFuncionario, "Lucas Pereira");
  assert.ok("fotoFuncionario" in resumo.funcionario);
  assert.equal(resumo.cadastradoPor.nomeGerente, "Ana Souza");

  assert.equal(resumo.servicos.total, 2);
  assert.equal(resumo.servicos.pacientesAtendidos, 2);
  assert.equal(resumo.servicos.unidadesEntregues, 5);
  assert.equal(resumo.servicos.topRemedios[0].nomeRemedio, "Dipirona");
  assert.equal(resumo.servicos.serie.length, 30);
  assert.equal(resumo.servicos.serie.reduce((t, d) => t + d.total, 0), 2);

  assert.equal(resumo.chamados.total, 1);
  assert.equal(resumo.chamados.porStatus.pendente, 1);
  assert.equal(resumo.chamados.porPrioridade.alta, 1);
  assert.deepEqual(resumo.totaisGerais.servicos, 2);
  assert.equal(serviceResumo.funcionario(999, SETEMBRO), null);
});

test("resumo do gerente: decisões, equipe, rede e estoque da farmácia", () => {
  // Beatriz (3), farmácia 3: respondeu o chamado 2; forneceu a Dipirona do chamado 3
  const resumo = serviceResumo.gerente(3, SETEMBRO);
  assert.equal(resumo.farmacia.nomeFarmacia, "Farmácia Saúde Leste");
  assert.equal(resumo.chamadosRespondidos.total, 1);
  assert.equal(resumo.chamadosRespondidos.aceitos, 1);
  assert.equal(resumo.chamadosRespondidos.tempoMedioRespostaMin, 30);

  assert.equal(resumo.rede.comoFornecedora.aceitos, 1);
  assert.equal(resumo.rede.comoFornecedora.unidadesEnviadas, 60);
  assert.equal(resumo.rede.comoFornecedora.respondidosPorEle, 1);

  assert.deepEqual(resumo.equipe.lista.map((f) => f.nomeFuncionario).sort(), ["Bruno Carvalho", "Larissa Mendes"]);
  assert.equal(resumo.cadastradosPorEle.funcionarios, 2);
  assert.equal(resumo.estoque.totalItens, 6);
  assert.equal(resumo.estoque.atencao[0].nomeRemedio, "Amoxicilina");
});

test("resumo da farmácia: gerentes, funcionários por turno, serviços e rede", () => {
  const resumo = serviceResumo.farmacia(1, SETEMBRO);
  assert.deepEqual(resumo.gerentes.map((g) => g.nomeGerente), ["Ana Souza", "Fernanda Costa"]);
  assert.equal(resumo.funcionarios.total, 3);
  assert.equal(resumo.funcionarios.porTurno.noite, 1);
  assert.equal(resumo.servicos.total, 3);
  assert.equal(resumo.chamados.porStatus.recusado, 1);
  assert.equal(resumo.rede.comoFornecedora.unidadesEnviadas, 80);
  assert.ok(resumo.estoque.unidades > 0);
});

test("resumo do remédio e do paciente", () => {
  const dipirona = serviceResumo.remedio(1, SETEMBRO);
  assert.equal(dipirona.rede.farmaciasComCadastro, 3);
  assert.equal(dipirona.rede.unidadesNaRede, 435);
  assert.equal(dipirona.servicos.unidadesEntregues, 2);
  assert.equal(dipirona.chamados.total, 2);
  assert.equal(dipirona.redistribuicoes.unidadesMovimentadas, 60);

  const joao = serviceResumo.paciente(2, SETEMBRO);
  assert.equal(joao.paciente.nomePaciente, "João Oliveira");
  assert.equal(joao.servicos.total, 2);
  assert.equal("pacientesAtendidos" in joao.servicos, false);
  assert.deepEqual(joao.farmacias.map((f) => f.nomeFarmacia).sort(), ["Farmácia Pedro João Neto", "Farmácia Vida"]);
});
