import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { abrirBanco, aplicarSchema, aplicarSeed } from "../database/setup.mjs";

// Tempo logado: o front manda sinal de presença; o gerente vê a equipe dele e o
// admin vê todos. Servidor de verdade num banco temporário com o seed (senha123).
test("tempo logado: presença, saída no logout e quem pode ver", async (t) => {
  const temp = await mkdtemp(path.join(tmpdir(), "intermedi-tempo-"));
  const dbPath = path.join(temp, "teste.db");
  const banco = abrirBanco(dbPath);
  aplicarSchema(banco);
  aplicarSeed(banco);
  banco.close();

  const env = {
    ...process.env, INTERMEDI_DB_PATH: dbPath, INTERMEDI_UPLOAD_DIR: path.join(temp, "uploads"),
    INTERMEDI_EMAIL_DIR: path.join(temp, "emails"), SMTP_HOST: "", PORT: "0", HOST: "127.0.0.1",
    INTERMEDI_EXIGIR_LOGIN: "true",
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
  const entrar = async (cpf, matricula) =>
    (await api("/auth/login", { method: "POST", corpo: { cpf, matricula, senha: "senha123" } })).dados.token;

  const lucas = await entrar("333.333.333-33", "000001"); // funcionário da farmácia 1
  const ana = await entrar("111.111.111-11", "G000001"); // gerente da farmácia 1
  const rafael = await entrar("777.777.777-77", "G000004"); // gerente de outra farmácia
  const admin = await entrar("999.999.999-99", "A000001");

  // presença: precisa de um token válido
  assert.equal((await api("/auth/presenca", { method: "POST", token: lucas })).status, 200);
  assert.equal((await api("/auth/presenca", { method: "POST" })).status, 401);

  // o gerente da farmácia vê o funcionário online
  const online = await api("/funcionario/1/acessos?dias=7", { token: ana });
  assert.equal(online.status, 200);
  assert.equal(online.dados.online, true);
  assert.equal(online.dados.sessoes[0].saida, null);

  // quem pode ver: o próprio, o gerente da farmácia e o admin
  assert.equal((await api("/funcionario/1/acessos", { token: lucas })).status, 200);
  assert.equal((await api("/funcionario/1/acessos", { token: rafael })).status, 403);
  assert.equal((await api("/funcionario/1/acessos", { token: admin })).status, 200);
  assert.equal((await api("/gerente/1/acessos", { token: admin })).status, 200);
  assert.equal((await api("/gerente/1/acessos", { token: lucas })).status, 403);

  // logout: a sessão ganha a hora de saída
  assert.equal((await api("/auth/logout", { method: "POST", token: lucas })).status, 200);
  const depois = await api("/funcionario/1/acessos", { token: ana });
  assert.equal(depois.dados.online, false);
  assert.ok(depois.dados.sessoes[0].saida);
  assert.ok(depois.dados.sessoes[0].duracaoMs >= 0);
});
