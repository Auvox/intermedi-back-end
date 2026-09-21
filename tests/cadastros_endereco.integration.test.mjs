import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { Router } from "../router.mjs";

// Toda a validação usa um banco em memória, sem alterar os cadastros reais.
process.env.INTERMEDI_DB_PATH = ":memory:";
const { default: db } = await import("../database/database.mjs");
const { default: farmaciaRoutes } = await import("../routes/farmacia.routes.mjs");
const { default: gerenteRoutes } = await import("../routes/gerente.routes.mjs");
const { default: funcionarioRoutes } = await import("../routes/funcionario.routes.mjs");
const { default: pacienteRoutes } = await import("../routes/paciente.routes.mjs");

function endereco(sufixo, logradouro = "endereco") {
  return {
    [`${logradouro}${sufixo}`]: `Rua ${sufixo}`,
    [`numero${sufixo}`]: "23",
    [`complemento${sufixo}`]: "Bloco B",
    [`bairro${sufixo}`]: "Centro",
    [`cidade${sufixo}`]: "Belo Horizonte",
    [`estado${sufixo}`]: "MG",
    [`cep${sufixo}`]: "30110-000",
  };
}

test("POSTs separam os endereços e mantêm os vínculos com rollback em erros", async (t) => {
  const router = new Router();
  for (const registrar of [farmaciaRoutes, gerenteRoutes, funcionarioRoutes, pacienteRoutes]) registrar(router);
  const server = createServer((req, res) => {
    const handler = router.find(req.method, new URL(req.url, "http://localhost").pathname);
    if (handler) return handler(req, res);
    res.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(route, method = "GET", data) {
    const response = await fetch(base + route, {
      method, headers: { "Content-Type": "application/json" },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    return { status: response.status, data: await response.json() };
  }
  function contagem() {
    return ["endereco", "farmacia", "gerente", "funcionario", "paciente"].map((tabela) =>
      db.prepare(`SELECT COUNT(*) AS total FROM ${tabela}`).get().total,
    );
  }

  const farmacia = { nomeFarmacia: "Farmácia Central", cnesFarmacia: "1234567", ...endereco("Farmacia") };
  const farmaciaCriada = await request("/farmacia", "POST", farmacia);
  assert.equal(farmaciaCriada.status, 201);
  const idFarmacia = farmaciaCriada.data.recebido.idFarmacia;
  const outraFarmacia = await request("/farmacia", "POST", { nomeFarmacia: "Farmácia Central", cnesFarmacia: "7654321" });
  const outroId = outraFarmacia.data.recebido.idFarmacia;

  // A seleção usa IDs reais, mesmo quando os nomes são iguais.
  const lista = (await request("/farmacia")).data.farmacia;
  assert.deepEqual(lista.map((f) => f.idFarmacia).sort(), [idFarmacia, outroId].sort());

  const idAdmin = Number(db.prepare("INSERT INTO admin (nome, email, senha_hash) VALUES (?, ?, ?)")
    .run("Admin de teste", "admin@example.test", "hash-apenas-no-teste").lastInsertRowid);
  const gerente = {
    nomeGerente: "Gerente Teste", emailGerente: "gerente@example.test", cpfGerente: "11111111111",
    crfGerente: "CRF-123", senhaGerente: "senha-teste", fkIdFarmacia: String(idFarmacia),
    idAdminCadastro: idAdmin, ...endereco("Gerente"),
  };
  const gerenteCriado = await request("/gerente", "POST", gerente);
  assert.equal(gerenteCriado.status, 201, JSON.stringify(gerenteCriado.data));
  const idGerente = gerenteCriado.data.recebido.idGerente;
  const funcionario = {
    nomeFuncionario: "Funcionário Teste", emailFuncionario: "funcionario@example.test",
    cpfFuncionario: "22222222222", senhaFuncionario: "senha-teste", turnoFuncionario: "Manhã",
    fkIdFarmacia: idFarmacia, idGerenteCadastro: idGerente, ...endereco("Funcionario"),
  };
  const funcionarioCriado = await request("/funcionario", "POST", funcionario);
  assert.equal(funcionarioCriado.status, 201);
  const paciente = { nomePaciente: "Paciente Teste", cpfPaciente: "33333333333", ...endereco("Paciente", "rua") };
  const pacienteCriado = await request("/paciente", "POST", paciente);
  assert.equal(pacienteCriado.status, 201);

  const cadastros = [
    ["farmacia", "Farmacia", farmaciaCriada, farmacia],
    ["gerente", "Gerente", gerenteCriado, gerente],
    ["funcionario", "Funcionario", funcionarioCriado, funcionario],
    ["paciente", "Paciente", pacienteCriado, paciente],
  ];
  const idsEnderecos = new Set();
  for (const [tabela, sufixo, criado, dados] of cadastros) {
    await t.test(`${tabela}: endereço próprio, consulta e edição sem perder o vínculo`, async () => {
      const id = criado.data.recebido[`id${sufixo}`];
      const salvo = db.prepare(`SELECT * FROM ${tabela} WHERE id_${tabela} = ?`).get(id);
      const enderecoSalvo = db.prepare("SELECT * FROM endereco WHERE id_endereco = ?").get(salvo.id_endereco);
      assert.equal(criado.data.recebido.idEndereco, salvo.id_endereco);
      assert.equal(enderecoSalvo.logradouro, `Rua ${sufixo}`);
      assert.equal(enderecoSalvo.uf, "MG");
      assert.equal(enderecoSalvo.complemento, "Bloco B");
      assert.ok(!idsEnderecos.has(salvo.id_endereco));
      idsEnderecos.add(salvo.id_endereco);
      if (tabela === "gerente" || tabela === "funcionario") {
        assert.equal(salvo.id_farmacia, idFarmacia);
        assert.equal(criado.data.recebido.fkIdFarmacia, idFarmacia);
      }
      if (tabela === "gerente") assert.equal(salvo.id_admin_cadastro, idAdmin);
      if (tabela === "funcionario") assert.equal(salvo.id_gerente_cadastro, idGerente);
      const editado = await request(`/${tabela}/${id}`, "PUT", { [`numero${sufixo}`]: "99" });
      assert.equal(editado.status, 201);
      const consultado = (await request(`/${tabela}/${id}`)).data.resultado;
      assert.equal(consultado.idEndereco, salvo.id_endereco);
      assert.equal(consultado[`numero${sufixo}`], "99");
      assert.equal(consultado[`cep${sufixo}`], dados[`cep${sufixo}`]);
      assert.equal(JSON.stringify(consultado).includes("senha-teste"), false);

      // Uma duplicação falha depois de inserir endereço: a transação deve desfazê-lo.
      const antes = contagem();
      assert.equal((await request(`/${tabela}`, "POST", dados)).status, 409);
      assert.deepEqual(contagem(), antes);
    });
  }

  await t.test("vínculos inválidos não criam pessoas nem endereços órfãos", async () => {
    const antes = contagem();
    for (const [route, dados] of [["/gerente", gerente], ["/funcionario", funcionario]]) {
      for (const vinculo of [
        { fkIdFarmacia: "" }, { fkIdFarmacia: 999999 }, { fkIdFarmacia: "abc" },
        { fkIdFarmacia: idFarmacia, idFarmacia: outroId },
      ]) {
        assert.equal((await request(route, "POST", { ...dados, ...vinculo })).status, 400);
      }
    }
    assert.equal((await request("/gerente", "POST", { ...gerente, idAdminCadastro: 999999 })).status, 400);
    assert.equal((await request("/funcionario", "POST", { ...funcionario, idGerenteCadastro: 999999 })).status, 400);
    assert.deepEqual(contagem(), antes);
  });

  await t.test("endereço incompleto é recusado e endereço omitido continua opcional", async () => {
    const antes = contagem();
    for (const [tabela, sufixo, , dados] of cadastros) {
      assert.equal((await request(`/${tabela}`, "POST", {
        ...dados, [`numero${sufixo}`]: "", [`cpf${sufixo}`]: "55555555555",
        [`email${sufixo}`]: "incompleto@example.test",
      })).status, 400);
    }
    assert.equal((await request("/farmacia", "POST", {
      nomeFarmacia: "Parcial", cnesFarmacia: "parcial", complementoFarmacia: "Bloco A",
    })).status, 400);
    assert.deepEqual(contagem(), antes);
    const semEndereco = await request("/gerente", "POST", {
      nomeGerente: "Sem endereço", cpfGerente: "44444444444", emailGerente: "sem@example.test",
      crfGerente: "CRF-456", idFarmacia: outroId,
    });
    assert.equal(semEndereco.status, 201);
    assert.equal(semEndereco.data.recebido.idEndereco, null);
    assert.equal(semEndereco.data.recebido.fkIdFarmacia, outroId);
    assert.equal(contagem()[0], antes[0]);
  });
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});
