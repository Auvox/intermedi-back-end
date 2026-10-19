import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { abrirBanco, aplicarSchema, aplicarSeed } from "../database/setup.mjs";

// Login da equipe com JWT: servidor de verdade num banco temporário com o seed
// (todos com a senha senha123). Os e-mails vão para uma pasta temporária.
test("login por CPF + matrícula + senha, permissões por perfil e farmácia, cadastro com e-mail e logout", async (t) => {
  const temp = await mkdtemp(path.join(tmpdir(), "intermedi-auth-"));
  const dbPath = path.join(temp, "teste.db");
  const pastaEmails = path.join(temp, "emails");
  const banco = abrirBanco(dbPath);
  aplicarSchema(banco);
  aplicarSeed(banco);
  banco.close();

  const env = {
    ...process.env, INTERMEDI_DB_PATH: dbPath, INTERMEDI_UPLOAD_DIR: path.join(temp, "uploads"),
    INTERMEDI_EMAIL_DIR: pastaEmails, SMTP_HOST: "", PORT: "0", HOST: "127.0.0.1",
  };
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
  const api = async (rota, { method = "GET", corpo, token } = {}) => {
    const resposta = await fetch(url + rota, {
      method, body: corpo && JSON.stringify(corpo),
      headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
    });
    return { status: resposta.status, dados: await resposta.json() };
  };
  const entrar = (cpf, matricula, senha = "senha123") =>
    api("/auth/login", { method: "POST", corpo: { cpf, matricula, senha } });

  // --- login: CPF com ou sem máscara, matrícula sem diferenciar maiúsculas
  const admin = await entrar("999.999.999-99", "A000001");
  assert.equal(admin.status, 200);
  assert.equal(admin.dados.usuario.papel, "admin");
  const ana = await entrar("11111111111", "g000001"); // gerente da farmácia 1
  assert.equal(ana.status, 200);
  assert.deepEqual(
    { papel: ana.dados.usuario.papel, idFarmacia: ana.dados.usuario.idFarmacia, nomeFarmacia: ana.dados.usuario.nomeFarmacia },
    { papel: "gerente", idFarmacia: 1, nomeFarmacia: "Farmácia Pedro João Neto" },
  );
  assert.equal(JSON.stringify(ana.dados).includes("scrypt"), false, "o hash da senha nunca sai");
  const lucas = await entrar("333.333.333-33", "000001"); // funcionário da farmácia 1
  assert.equal(lucas.dados.usuario.papel, "funcionario");
  const julia = await entrar("444.444.444-44", "000002"); // funcionária da farmácia 2
  assert.equal(julia.status, 200);

  assert.equal((await entrar("111.111.111-11", "G000001", "errada")).status, 401);
  assert.equal((await entrar("111.111.111-11", "G000002")).status, 401, "matrícula de outra pessoa");
  assert.equal((await api("/auth/login", { method: "POST", corpo: { cpf: "111", matricula: "G000001" } })).status, 400);

  // --- sem login, token inválido ou adulterado: 401
  assert.equal((await api("/funcionario")).status, 401);
  assert.equal((await api("/funcionario", { token: "abc.def.ghi" })).status, 401);
  const [cabecalho, corpo, assinatura] = ana.dados.token.split(".");
  const corpoAdmin = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(corpo, "base64url")), papel: "admin" })).toString("base64url");
  assert.equal((await api("/auth/me", { token: `${cabecalho}.${corpoAdmin}.${assinatura}` })).status, 401, "trocar o papel invalida a assinatura");
  const semAlg = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  assert.equal((await api("/auth/me", { token: `${semAlg}.${corpo}.` })).status, 401, "alg none é recusado");

  // rotas públicas continuam abertas
  assert.equal((await api("/remedios")).status, 200);
  assert.equal((await api("/farmacia")).status, 200);

  // --- /auth/me devolve a pessoa e a farmácia dela
  const eu = await api("/auth/me", { token: lucas.dados.token });
  assert.equal(eu.status, 200);
  assert.equal(eu.dados.usuario.idFarmacia, 1);

  // --- perfil errado: 403
  const novoGerente = {
    nomeGerente: "Gerente Novo", emailGerente: "gerente.novo@example.test", cpfGerente: "123.456.789-09",
    crfGerente: "CRF-SP 9999", fkIdFarmacia: 2,
  };
  assert.equal((await api("/gerente", { method: "POST", corpo: novoGerente, token: ana.dados.token })).status, 403, "gerente não cadastra gerente");
  assert.equal((await api("/gerente", { method: "POST", corpo: novoGerente, token: lucas.dados.token })).status, 403);
  assert.equal((await api("/funcionario", { method: "POST", corpo: {}, token: lucas.dados.token })).status, 403, "funcionário não cadastra funcionário");
  assert.equal((await api("/remedios", { method: "POST", corpo: {}, token: ana.dados.token })).status, 403, "só o admin mexe no catálogo");

  // --- outra farmácia: 403; listas só com a farmácia de quem pede
  assert.equal((await api("/gerente/2/estoque", { token: ana.dados.token })).status, 403);
  assert.equal((await api("/gerente/1/estoque", { token: ana.dados.token })).status, 200);
  assert.equal((await api("/gerente/1/chamados", { token: lucas.dados.token })).status, 200, "funcionário vê os pedidos da própria unidade");
  assert.equal((await api("/gerente/1/chamados", { token: julia.dados.token })).status, 403);
  assert.equal((await api("/funcionario/1/chamado", { method: "POST", corpo: { remedios: [{ idRemedio: 1, quantidade: 1 }] }, token: julia.dados.token })).status, 403, "só abre chamado em nome próprio");
  const equipeDaAna = (await api("/funcionario", { token: ana.dados.token })).dados.funcionario;
  assert.ok(equipeDaAna.length > 0 && equipeDaAna.every((f) => f.fkIdFarmacia === 1));
  assert.ok((await api("/funcionario", { token: admin.dados.token })).dados.funcionario.some((f) => f.fkIdFarmacia !== 1));

  // --- admin cadastra gerente: matrícula G + 6 dígitos e e-mail com ela
  const gerenteCriado = await api("/gerente", { method: "POST", corpo: novoGerente, token: admin.dados.token });
  assert.equal(gerenteCriado.status, 201, JSON.stringify(gerenteCriado.dados));
  assert.match(gerenteCriado.dados.matricula, /^G\d{6}$/);
  assert.equal(gerenteCriado.dados.email.status, "teste");
  const emailGerente = await readFile(path.join(pastaEmails, gerenteCriado.dados.email.arquivo), "utf8");
  assert.ok(emailGerente.includes(novoGerente.emailGerente));
  assert.ok(emailGerente.includes(gerenteCriado.dados.matricula));
  assert.equal(gerenteCriado.dados.senhaProvisoria, undefined, "a senha só vai no e-mail");
  assert.equal(JSON.stringify(gerenteCriado.dados.recebido).includes("senha"), false);

  // --- gerente cadastra funcionário: vai para a farmácia dele, mesmo pedindo outra
  const criado = await api("/funcionario", {
    method: "POST", token: ana.dados.token,
    corpo: { nomeFuncionario: "Func Novo", emailFuncionario: "func.novo@example.test", cpfFuncionario: "987.654.321-00", fkIdFarmacia: 3 },
  });
  assert.equal(criado.status, 201, JSON.stringify(criado.dados));
  assert.equal(criado.dados.recebido.fkIdFarmacia, 1);
  assert.match(criado.dados.matricula, /^\d{6}$/);
  const detalhe = (await api(`/funcionario/${criado.dados.recebido.idFuncionario}`, { token: ana.dados.token })).dados.resultado;
  assert.equal(detalhe.idGerenteCadastro, ana.dados.usuario.id);

  // o e-mail traz a marca, a matrícula e a senha provisória; com ela o funcionário entra
  const emails = await readdir(pastaEmails);
  const arquivo = emails.find((nome) => nome.includes("func.novo"));
  assert.ok(arquivo, `e-mail salvo em ${pastaEmails}`);
  const html = await readFile(path.join(pastaEmails, arquivo), "utf8");
  assert.ok(html.includes("Auvox") && html.includes(criado.dados.matricula));
  const senhaProvisoria = html.match(/Senha provisória<\/td>\s*<\/tr>\s*<tr>\s*<td[^>]*>([^<]+)</)?.[1];
  assert.ok(senhaProvisoria);
  const novo = await entrar("98765432100", criado.dados.matricula, senhaProvisoria);
  assert.equal(novo.status, 200);
  assert.equal(novo.dados.usuario.idFarmacia, 1);

  // --- o gerente responde em nome dele, mesmo mandando outro idGerente
  const chamado = (await api("/funcionario/1/chamado", {
    method: "POST", token: lucas.dados.token, corpo: { remedios: [{ idRemedio: 1, quantidade: 1 }] },
  })).dados.chamado;
  assert.ok(chamado?.idChamado);
  const resposta = await api(`/chamado/${chamado.idChamado}/responder`, {
    method: "PUT", token: ana.dados.token, corpo: { idGerente: 5, aceitar: false, resposta: "teste" },
  });
  assert.equal(resposta.status, 200, JSON.stringify(resposta.dados));
  // a Fernanda (id 5) também é gerente da farmácia 1, mas quem respondeu foi a Ana
  assert.equal(resposta.dados.chamado.resposta.idGerente, ana.dados.usuario.id);

  // --- logout: o token deixa de valer; outro login continua valendo
  assert.equal((await api("/auth/logout", { method: "POST", token: lucas.dados.token })).status, 200);
  assert.equal((await api("/auth/me", { token: lucas.dados.token })).status, 401);
  assert.equal((await api("/auth/me", { token: ana.dados.token })).status, 200);
  assert.equal((await api("/auth/logout", { method: "POST" })).status, 200, "sair sem sessão não dá erro");

  // --- trocar a senha derruba as sessões abertas
  assert.equal((await api(`/gerente/${ana.dados.usuario.id}`, { method: "PUT", token: ana.dados.token, corpo: { senhaGerente: "nova-senha-123" } })).status, 201);
  assert.equal((await api("/auth/me", { token: ana.dados.token })).status, 401);
  assert.equal((await entrar("111.111.111-11", "G000001", "nova-senha-123")).status, 200);
});
