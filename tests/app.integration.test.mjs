//pedi para a IA criar um tipo de teste que Cria 
// um banco temporário com dados fictícios
//Inicia um servidor de teste em uma porta livre
///Testa cadastro, login, edição, foto, exclusão e compatibilidade com as rotas do site
//Mostra quais testes passaram ou falharam
//Encerra o servidor e remove os arquivos temporários
//so rodar npm test


import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

test('backend unificado: app e contratos do site no mesmo banco isolado', async (t) => {
  const temp = await mkdtemp(path.join(tmpdir(), 'intermedi-test-'));
  const dbPath = path.join(temp, 'test.sqlite');
  const fixture = new DatabaseSync(dbPath);
  fixture.exec(await readFile(new URL('./schema.fixture.sql', import.meta.url), 'utf8'));
  fixture.close();
  const env = { ...process.env, INTERMEDI_DB_PATH: dbPath, INTERMEDI_UPLOAD_DIR: path.join(temp, 'uploads'), PORT: '0', HOST: '127.0.0.1' };
  let child;
  async function start() {
    child = spawn(process.execPath, [fileURLToPath(new URL('../server.mjs', import.meta.url))], { cwd: temp, env, stdio: ['ignore', 'pipe', 'pipe'] });
    return await new Promise((resolve, reject) => {
      let output = '';
      let errors = '';
      const timer = setTimeout(() => reject(new Error('Servidor não iniciou: ' + errors)), 10000);
      child.stderr.on('data', c => { errors += c; });
      child.once('error', reject);
      child.once('exit', code => { clearTimeout(timer); if (code) reject(new Error(errors)); });
      child.stdout.on('data', chunk => {
        output += chunk;
        const match = output.match(/Servidor: http:\/\/localhost:(\d+)/);
        if (match) { clearTimeout(timer); resolve(`http://127.0.0.1:${match[1]}`); }
      });
    });
  }
  async function stop() { const exited = once(child, 'exit'); child.kill(); await exited; }
  t.after(async () => { if (child?.exitCode === null && !child.killed) await stop(); await rm(temp, { recursive: true, force: true }); });
  let url = await start();
  async function request(route, method = 'GET', data, token) {
    const response = await fetch(url + route, { method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: data === undefined ? undefined : JSON.stringify(data) });
    return { status: response.status, data: await response.json() };
  }
  const payload = { nomePaciente: 'Pessoa de teste', cpfPaciente: '123.456.789-00', telPaciente: '11912345678',
    emailPaciente: 'teste@example.com', senhaPaciente: 'teste-senha', medicamentoFrequentePaciente: '',
    cepPaciente: '01001000', ruaPaciente: 'Rua preservada', numeroPaciente: '12', bairroPaciente: 'Centro',
    cidadePaciente: 'São Paulo', estadoPaciente: 'SP', complementoPaciente: 'A' };
  const created = await request('/paciente', 'POST', payload);
  assert.equal(created.status, 201);
  const id = created.data.recebido.idPaciente;
  assert.ok(id);
  assert.equal((await request('/paciente')).data.paciente.length, 1);
  assert.equal((await request('/api/auth/login', 'POST', { email: payload.emailPaciente, senha: 'errada' })).status, 401);
  const login = await request('/api/auth/login', 'POST', { email: 'TESTE@example.com', senha: payload.senhaPaciente });
  assert.equal(login.status, 200);
  const token = login.data.token;
  assert.equal(login.data.user.id, id);
  assert.equal(JSON.stringify(login.data).includes('teste-senha'), false);
  assert.equal((await request('/api/pacientes/me')).status, 401);
  assert.equal((await request('/api/pacientes/me', 'PUT', { nomePaciente: 'Editado pelo app' }, token)).status, 200);
  const fromSite = (await request(`/paciente/${id}`)).data.resultado;
  assert.equal(fromSite.nomePaciente, 'Editado pelo app');
  assert.equal(fromSite.ruaPaciente, payload.ruaPaciente);
  assert.equal(fromSite.senhaPaciente, payload.senhaPaciente);
  assert.equal((await request('/api/pacientes/me', 'PUT', { nomePaciente: '' }, token)).status, 400);
  assert.equal((await request('/api/auth/register', 'POST', payload)).status, 409);
  assert.equal((await request('/api/auth/register', 'POST', { ...payload, cpfPaciente: '12345678900', emailPaciente: 'other@example.com' })).status, 409);
  const second = await request('/api/auth/register', 'POST', { ...payload, cpfPaciente: '222.333.444-55', emailPaciente: 'second@example.com' });
  assert.equal(second.status, 201);
  const secondId = second.data.user.id;
  const logoutToken = (await request('/api/auth/login', 'POST', { email: 'second@example.com', senha: payload.senhaPaciente })).data.token;
  assert.equal((await request('/api/auth/logout', 'POST', undefined, logoutToken)).status, 200);
  assert.equal((await request('/api/pacientes/me', 'GET', undefined, logoutToken)).status, 401);
  assert.equal((await request(`/api/pacientes/${secondId}/foto`, 'PUT', {}, token)).status, 403);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9wAAAABJRU5ErkJggg==', 'base64');
  async function photo(bytes, type = 'image/png') {
    const form = new FormData(); form.set('foto', new Blob([bytes], { type }), 'perfil.png');
    return fetch(url + `/api/pacientes/${id}/foto`, { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: form });
  }
  assert.equal((await photo(Buffer.from('<script>bad</script>'))).status, 400);
  assert.equal((await photo(Buffer.alloc(5 * 1024 * 1024 + 1))).status, 413);
  const uploaded = await photo(png);
  assert.equal(uploaded.status, 200);
  const photoPath = (await uploaded.json()).fotoPerfilPaciente;
  assert.equal((await fetch(url + photoPath)).headers.get('content-type'), 'image/png');
  assert.equal((await request(`/paciente/${id}`)).data.resultado.fotoPerfilPaciente, photoPath);
  const preflight = await fetch(url + '/api/pacientes/me', { method: 'OPTIONS' });
  assert.equal(preflight.status, 204);
  // Reiniciar preserva banco, sessão e foto, sem repetir ALTER TABLE.
  await stop(); url = await start();
  assert.equal((await request('/api/pacientes/me', 'GET', undefined, token)).status, 200);
  const otherSession = (await request('/api/auth/login', 'POST', { email: payload.emailPaciente, senha: payload.senhaPaciente })).data.token;
  assert.equal((await request('/api/pacientes/me', 'PUT', { senhaPaciente: 'nova-senha' }, token)).status, 200);
  assert.equal((await request('/api/pacientes/me', 'GET', undefined, otherSession)).status, 401);
  assert.equal((await request('/api/pacientes/me', 'GET', undefined, token)).status, 200);
  assert.equal((await request('/api/pacientes/me', 'DELETE', undefined, token)).status, 200);
  assert.equal((await request('/api/pacientes/me', 'GET', undefined, token)).status, 401);
  assert.equal((await fetch(url + photoPath)).status, 404);
  assert.equal((await request('/paciente')).data.paciente.length, 1);
  // O PUT/DELETE do site continuam com seus formatos originais.
  const beforeSiteEdit = (await request('/api/auth/login', 'POST', { email: 'second@example.com', senha: payload.senhaPaciente })).data.token;
  const siteUpdated = await request(`/paciente/${secondId}`, 'PUT', { ...payload, cpfPaciente: '222.333.444-55', nomePaciente: 'Site', senhaPaciente: 'senha-alterada-no-site' });
  assert.equal(siteUpdated.status, 201);
  assert.equal(siteUpdated.data.alterados, 1);
  assert.equal((await request('/api/pacientes/me', 'GET', undefined, beforeSiteEdit)).status, 401);
  const beforeSiteDelete = (await request('/api/auth/login', 'POST', { email: payload.emailPaciente, senha: 'senha-alterada-no-site' })).data.token;
  assert.equal((await request(`/paciente/${secondId}`, 'DELETE')).status, 200);
  assert.equal((await request('/api/pacientes/me', 'GET', undefined, beforeSiteDelete)).status, 401);
  assert.equal((await request('/paciente')).data.paciente.length, 0);
  // Teste já existente do site também usa o banco temporário.
  const legacy = spawn(process.execPath, ['--test', fileURLToPath(new URL('./funcionario_fk_farmacia.test.mjs', import.meta.url))], { env, cwd: temp });
  let legacyOutput = '';
  legacy.stdout.on('data', chunk => { legacyOutput += chunk; });
  legacy.stderr.on('data', chunk => { legacyOutput += chunk; });
  const [code] = await once(legacy, 'exit');
  assert.equal(code, 0, legacyOutput);
});
