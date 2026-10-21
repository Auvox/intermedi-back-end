import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

// Banco temporário em arquivo: o teste do "banco travado" precisa de uma
// segunda conexão segurando o arquivo (nunca mexe no banco local)
const temp = await mkdtemp(path.join(tmpdir(), "intermedi-desempenho-"));
const dbPath = path.join(temp, "test.db");
process.env.INTERMEDI_DB_PATH = dbPath;

const { default: db } = await import("../database/database.mjs");
const analytics = await import("../services/analytics.service.mjs");
const monitor = await import("../services/monitor.service.mjs");
const alertas = await import("../services/alerta.service.mjs");
const { autorizar } = await import("../services/acesso.service.mjs");
const { assinarJwt } = await import("../utils/jwt.mjs");
const { painelSaude } = await import("../services/saude.service.mjs");
const { lerFiltros } = await import("../utils/periodo-desempenho.mjs");

test.after(async () => {
  db.close();
  await rm(temp, { recursive: true, force: true });
});
test.beforeEach(() => analytics.limparCacheAnalytics());

const AGORA = Date.now();
const filtros = (query = "periodo=7d") => lerFiltros(new URL(`http://x/?${query}`), AGORA + 1000);
const clique = (extra = {}) => ({
  rota: "/gerente/chamados", x: 0.5, y: 0.2, elemento: "responder-chamado", interativo: true,
  plataforma: "web", persona: "gerente", usuarioId: 3, farmaciaId: 3,
  largura: 1440, altura: 900, dispositivo: "desktop", sessao: "sessao-teste-1", em: AGORA,
  ...extra,
});

test("lote de cliques: grava os válidos, ignora os inválidos e nunca grava texto", () => {
  const r = analytics.registrarLote({
    cliques: [
      clique(),
      clique({ x: 1.4 }), // fora da tela
      clique({ persona: "hacker" }),
      clique({ elemento: "Maria Santos digitou isto", valor: "senha123", texto: "segredo" }),
    ],
    visitas: [{ rota: "/gerente/chamados/", plataforma: "web", persona: "gerente", dispositivo: "desktop", duracaoMs: 42000, saida: true, em: AGORA }],
  }, AGORA);
  assert.deepEqual(r, { cliques: 2, visitas: 1, ignorados: 2 });

  const linhas = db.prepare("SELECT * FROM clique_evento ORDER BY id").all();
  assert.equal(linhas.length, 2);
  assert.equal(linhas[1].elemento, null, "texto livre não vira identificador");
  assert.equal(JSON.stringify(linhas).includes("senha123"), false);
  assert.equal(JSON.stringify(linhas).includes("segredo"), false);
  assert.equal(db.prepare("SELECT rota FROM tela_visita").get().rota, "/gerente/chamados", "rota normalizada");

  assert.throws(() => analytics.registrarLote({}), { status: 400 });
  assert.throws(() => analytics.registrarLote({ cliques: Array(501).fill(clique()) }), { status: 413 });
});

test("rotas são normalizadas (ids viram :id, sem query nem barra final)", () => {
  assert.equal(analytics.normalizarRota("/medicamento/12?x=1"), "/medicamento/:id");
  assert.equal(analytics.normalizarRota("/gerente/"), "/gerente");
  assert.equal(analytics.normalizarRota("/"), "/");
  assert.equal(analytics.normalizarRota("javascript:alert(1)"), null);
});

test("mapa de calor e ranking: pontos, elemento mais clicado, cliques sem resposta e abandono", () => {
  analytics.registrarLote({
    cliques: [
      clique({ x: 0.5, y: 0.2 }), clique({ x: 0.501, y: 0.2 }),
      clique({ x: 0.9, y: 0.9, elemento: null, interativo: false }),
      clique({ rota: "/pesquisa", plataforma: "app", persona: "paciente", usuarioId: 7, farmaciaId: null, dispositivo: "celular", largura: 390, altura: 844, interativo: null, elemento: null }),
    ],
    visitas: [
      { rota: "/gerente/chamados", plataforma: "web", persona: "gerente", dispositivo: "desktop", duracaoMs: 18000, saida: false, em: AGORA },
      { rota: "/pesquisa", plataforma: "app", persona: "paciente", dispositivo: "celular", duracaoMs: 5000, saida: true, em: AGORA },
    ],
  }, AGORA);

  const mapa = analytics.pontosDoMapa(filtros(), { rota: "/gerente/chamados" });
  assert.equal(mapa.cliques, 5);
  assert.equal(mapa.semResposta, 1);
  assert.equal(mapa.elementoMaisClicado.elemento, "responder-chamado");
  assert.equal(mapa.visitas, 2);
  assert.equal(mapa.tempoMedioMs, 30000);
  assert.ok(mapa.pontos.some((p) => p.x === 0.5 && p.y === 0.2 && p.peso >= 3), "cliques próximos somam peso");

  const soApp = analytics.rankingRotas(filtros("periodo=7d&plataforma=app"));
  assert.deepEqual(soApp.map((r) => r.rota), ["/pesquisa"]);
  assert.equal(soApp[0].taxaAbandono, 100);

  const doGerente = analytics.rankingRotas(filtros("periodo=7d&farmacia=3"));
  assert.ok(doGerente.every((r) => r.rota !== "/pesquisa"), "filtro de farmácia");

  assert.throws(() => analytics.pontosDoMapa(filtros(), {}), { status: 400 });
});

test("visão geral compara com o período anterior", () => {
  // uma requisição hoje (com erro) e uma no período anterior
  monitor.reiniciarMonitorParaTeste();
  monitor.registrarRequisicao({ rota: "/remedios", metodo: "GET", status: 500, duracaoMs: 120 }, AGORA);
  monitor.registrarRequisicao({ rota: "/remedios", metodo: "GET", status: 200, duracaoMs: 80 }, AGORA);
  monitor.registrarRequisicao({ rota: "/remedios", metodo: "GET", status: 200, duracaoMs: 60 }, AGORA - 8 * 86400000);
  assert.equal(monitor.gravarFila(AGORA), true);

  const resumo = analytics.resumoGeral(filtros());
  assert.equal(resumo.indicadores.taxaErro.valor, 50);
  assert.equal(resumo.indicadores.tempoMedioMs.valor, 100);
  assert.equal(resumo.indicadores.tempoMedioMs.anterior, 60);
  assert.equal(resumo.indicadores.cliques.valor, 6);
  assert.ok(resumo.indicadores.usuariosAtivos.valor >= 2);
  assert.equal(resumo.serie.length, 7, "um ponto por dia");
  assert.equal(resumo.serie.at(-1).erros, 1);
  assert.equal(resumo.maisAcessadas[0].rota, "/gerente/chamados");
  assert.throws(() => lerFiltros(new URL("http://x/?periodo=ontem")), { status: 400 });
});

test("rota que falha 3 vezes seguidas vira alerta crítico com causa e passos", () => {
  monitor.reiniciarMonitorParaTeste();
  alertas.limparAlertasEmMemoria();
  for (let i = 0; i < 3; i++) {
    monitor.registrarRequisicao({ rota: "/remedios", metodo: "GET", status: 500, duracaoMs: 30 }, AGORA);
    monitor.registrarErro({ error: new Error("database is locked"), rota: "/remedios", metodo: "GET" }, AGORA);
  }
  const novos = monitor.verificarAlertas(AGORA + 1000);
  const alerta = novos.find((a) => a.tipo === "rota-fora");
  assert.ok(alerta, JSON.stringify(novos));
  assert.equal(alerta.severidade, "critico");
  assert.match(alerta.causa, /banco de dados/);
  assert.ok(alerta.passos.length >= 3);

  // de novo: não duplica, só soma ocorrência
  monitor.registrarRequisicao({ rota: "/remedios", metodo: "GET", status: 500, duracaoMs: 30 }, AGORA + 2000);
  assert.equal(monitor.verificarAlertas(AGORA + 3000).some((a) => a.tipo === "rota-fora"), false);
  const ativos = alertas.listarAlertas({ status: "ativo" }, AGORA + 3000).alertas.filter((a) => a.tipo === "rota-fora");
  assert.equal(ativos.length, 1);
  assert.equal(ativos[0].ocorrencias, 2);

  // silenciar por 1 hora e resolver
  const silenciado = alertas.silenciarAlerta(ativos[0].id, 60, AGORA + 4000);
  assert.equal(silenciado.status, "silenciado");
  assert.equal(monitor.verificarAlertas(AGORA + 5000).some((a) => a.tipo === "rota-fora"), false, "silenciado não avisa de novo");
  assert.equal(alertas.resolverAlerta(ativos[0].id, AGORA + 6000).status, "resolvido");
  assert.equal(alertas.listarAlertas({ status: "resolvido" }).alertas[0].id, ativos[0].id, "vai para o histórico");
});

test("taxa de erro, lentidão e falhas de login", () => {
  monitor.reiniciarMonitorParaTeste();
  for (let i = 0; i < 20; i++) {
    monitor.registrarRequisicao({ rota: "/farmacia", metodo: "GET", status: i % 5 === 0 ? 500 : 200, duracaoMs: i < 2 ? 2500 : 40 }, AGORA);
  }
  for (let i = 0; i < 12; i++) monitor.registrarRequisicao({ rota: "/auth/login", metodo: "POST", status: 401, duracaoMs: 20 }, AGORA);
  const tipos = monitor.verificarAlertas(AGORA + 1000).map((a) => a.tipo);
  assert.ok(tipos.includes("erro-rota"), tipos.join());
  assert.ok(tipos.includes("rota-lenta"), tipos.join());
  assert.ok(tipos.includes("login"), tipos.join());
});

test("banco travado por outro programa: o alerta aparece mesmo sem conseguir gravar", () => {
  monitor.reiniciarMonitorParaTeste();
  db.prepare(`INSERT INTO alerta (tipo, chave, severidade, titulo, o_que, causa, como_resolver, criado_em, atualizado_em)
    VALUES ('login', 'login:teste', 'atencao', 'Já existia', 'o que', 'causa', '1. passo', ?, ?)`).run(AGORA, AGORA);
  const jaExistia = alertas.listarAlertas({ status: "ativo" }).alertas.find((a) => a.chave === "login:teste");
  const outroPrograma = new DatabaseSync(dbPath);
  outroPrograma.exec("BEGIN EXCLUSIVE");
  try {
    const novos = monitor.verificarAlertas(AGORA + 10000);
    const banco = novos.find((a) => a.tipo === "banco");
    assert.ok(banco, JSON.stringify(novos));
    assert.equal(banco.severidade, "critico");
    assert.equal(banco.titulo, "O banco de dados está travado");
    assert.ok(banco.naoGravado, "ficou em memória");
    const travado = alertas.listarAlertas({ status: "ativo" });
    assert.equal(travado.bancoDisponivel, false);
    assert.ok(travado.alertas.some((a) => a.tipo === "banco"));
    assert.ok(travado.alertas.some((a) => a.id === jaExistia.id), "o alerta que já existia continua na lista");

    // o admin continua vendo os alertas (a sessão não dá pra conferir, vale a assinatura)
    const token = (papel) => ({ headers: { authorization: `Bearer ${assinarJwt({ papel, id: 1, jti: "teste", exp: Math.floor(Date.now() / 1000) + 60 })}` } });
    assert.doesNotThrow(() => autorizar(token("admin"), "GET /alertas"));
    assert.doesNotThrow(() => autorizar(token("admin"), "GET /saude"));
    assert.throws(() => autorizar(token("gerente"), "GET /alertas"), /locked/);
    assert.throws(() => autorizar({ headers: { authorization: "Bearer falso" } }, "GET /alertas"), { status: 401 });
    assert.throws(() => autorizar(token("admin"), "PUT /alertas/:id/resolver"), /locked/);
    assert.throws(() => autorizar(token("admin"), "GET /analytics/resumo"), /locked/);
  } finally {
    outroPrograma.exec("ROLLBACK");
    outroPrograma.close();
  }
  // banco liberado: o alerta é gravado na próxima verificação
  monitor.verificarAlertas(AGORA + 70000);
  assert.ok(db.prepare("SELECT 1 FROM alerta WHERE tipo = 'banco' AND status = 'ativo'").get());
});

test("só o admin vê o desempenho, mesmo com o login desligado; os cliques continuam públicos", () => {
  delete process.env.INTERMEDI_EXIGIR_LOGIN;
  const req = { headers: {} };
  assert.throws(() => autorizar(req, "GET /analytics/rotas"), { status: 401 });
  assert.throws(() => autorizar({ headers: {} }, "GET /alertas"), { status: 401 });
  assert.throws(() => autorizar({ headers: { authorization: "Bearer falso" } }, "GET /saude"), { status: 401 });
  assert.doesNotThrow(() => autorizar({ headers: {} }, "POST /analytics/cliques"));
  assert.doesNotThrow(() => autorizar({ headers: {} }, "GET /remedios"));
});

test("os resumos ficam 15 s em cache e um lote novo de cliques limpa o cache", () => {
  const antes = analytics.rankingRotas(filtros("periodo=30d"));
  assert.equal(analytics.rankingRotas(filtros("periodo=30d")), antes);
  analytics.registrarLote({ cliques: [clique({ rota: "/gerente/estoque" })] });
  const depois = analytics.rankingRotas(filtros("periodo=30d"));
  assert.notEqual(depois, antes);
  assert.ok(depois.some((r) => r.rota === "/gerente/estoque"));
});

test("saúde do sistema: média e p95 do tempo de resposta por faixa", () => {
  db.exec("DELETE FROM requisicao_log");
  const inserir = db.prepare("INSERT INTO requisicao_log (rota, metodo, status, duracao_ms, plataforma, criado_em) VALUES (?, ?, ?, ?, ?, ?)");
  for (let ms = 1; ms <= 100; ms++) inserir.run("/remedios", "GET", ms === 100 ? 500 : 200, ms, "web", AGORA - 1000);
  const painel = painelSaude(filtros("periodo=hoje"));
  const faixa = painel.tempoResposta.find((t) => t.p95Ms !== null);
  assert.equal(faixa.p95Ms, 95);
  assert.equal(faixa.mediaMs, 51);
  assert.equal(painel.totais.requisicoes, 100);
  assert.deepEqual(painel.rotasComErro.map((r) => [r.rota, r.erros, r.taxa]), [["/remedios", 1, 1]]);
});
