import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db, { emTransacao } from '../database/database.mjs';
import * as pacientes from '../services/paciente.service.mjs';
import { traduzirErro } from '../utils/http.mjs';
import { verificarSenha } from '../utils/senha.mjs';

const uploads = process.env.INTERMEDI_UPLOAD_DIR || fileURLToPath(new URL('../uploads/perfis/', import.meta.url));
const fields = ['nomePaciente', 'cpfPaciente', 'telPaciente', 'emailPaciente', 'senhaPaciente',
  'medicamentoFrequentePaciente', 'cepPaciente', 'ruaPaciente', 'numeroPaciente',
  'bairroPaciente', 'cidadePaciente', 'estadoPaciente', 'complementoPaciente'];
const hash = (value) => createHash('sha256').update(String(value)).digest('hex');
// Muda sempre que a senha muda -> sessões antigas deixam de valer
const fingerprint = (idPaciente) => hash(pacientes.buscarSenhaHash(idPaciente) ?? '');
const fail = (status, message) => Object.assign(new Error(message), { status });
const json = (res, status, data) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
};

function publicUser(p) {
  return { id: Number(p.idPaciente), nome: p.nomePaciente, email: p.emailPaciente,
    cpf: p.cpfPaciente, telefone: p.telPaciente ?? '',
    remedioFrequente: p.medicamentoFrequentePaciente ?? '', fotoPerfilPaciente: p.fotoPerfilPaciente ?? null };
}

async function body(req, limit = 32 * 1024) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw fail(413, 'Arquivo ou dados excedem o limite permitido.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson(req) {
  try {
    const data = JSON.parse((await body(req)).toString('utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw fail(400, 'JSON inválido.');
    return data;
  } catch (error) { throw error.status ? error : fail(400, 'JSON inválido.'); }
}

function authenticated(req) {
  const token = req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token) throw fail(401, 'Faça login novamente.');
  const session = db.prepare('SELECT * FROM sessao_paciente WHERE token_hash = ? AND expira_em > ?').get(hash(token), Date.now());
  const user = session && pacientes.buscarPorId(session.id_paciente);
  if (!user || session.senha_fingerprint !== fingerprint(user.idPaciente)) throw fail(401, 'Sua sessão expirou. Faça login novamente.');
  if (req.params?.id && Number(req.params.id) !== Number(user.idPaciente)) throw fail(403, 'Acesso não permitido.');
  return user;
}

function validate(data, partial = false) {
  for (const name of fields) {
    if (data[name] !== undefined && (typeof data[name] !== 'string' || data[name].length > 500)) {
      throw fail(400, `Campo inválido: ${name}.`);
    }
  }
  for (const name of ['nomePaciente', 'cpfPaciente', 'emailPaciente', 'senhaPaciente']) {
    if ((!partial || data[name] !== undefined) && !data[name]?.trim()) throw fail(400, 'Preencha nome, CPF, e-mail e senha.');
  }
  if (data.emailPaciente !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.emailPaciente)) throw fail(400, 'E-mail inválido.');
}

function duplicate(data, id = -1) {
  if (pacientes.existeDuplicado(data.emailPaciente, data.cpfPaciente, id)) throw fail(409, 'E-mail ou CPF já cadastrado.');
}

export default function appRoutes(router) {
  const route = (method, url, fn) => router[method](url, async (req, res) => {
    try { await fn(req, res); }
    catch (error) {
      const { status, mensagem } = traduzirErro(error);
      json(res, status, { message: mensagem });
    }
  });

  route('post', '/api/auth/register', async (req, res) => {
    const data = await readJson(req);
    validate(data);
    data.emailPaciente = data.emailPaciente.trim();
    data.cpfPaciente = data.cpfPaciente.trim();
    duplicate(data);
    for (const name of fields) data[name] ??= '';
    const created = pacientes.cadastrar(data);
    json(res, 201, { message: 'Conta criada com sucesso.', user: publicUser(pacientes.buscarPorId(created.idPaciente)) });
  });

  route('post', '/api/auth/login', async (req, res) => {
    const { email, senha } = await readJson(req);
    if (typeof email !== 'string' || typeof senha !== 'string' || !senha) throw fail(400, 'Informe e-mail e senha.');
    const credenciais = pacientes.buscarCredenciais(email);
    if (!verificarSenha(senha, credenciais?.senhaHash)) {
      throw fail(401, 'E-mail ou senha incorretos.');
    }
    const user = pacientes.buscarPorId(credenciais.idPaciente);
    const token = randomBytes(32).toString('hex');
    db.prepare('DELETE FROM sessao_paciente WHERE expira_em <= ?').run(Date.now());
    db.prepare('INSERT INTO sessao_paciente (token_hash, id_paciente, senha_fingerprint, expira_em) VALUES (?, ?, ?, ?)')
      .run(hash(token), user.idPaciente, fingerprint(user.idPaciente), Date.now() + 7 * 86400000);
    json(res, 200, { user: publicUser(user), token });
  });

  route('post', '/api/auth/logout', async (req, res) => {
    const token = req.headers.authorization?.replace(/^Bearer /, '') || '';
    db.prepare('DELETE FROM sessao_paciente WHERE token_hash = ?').run(hash(token));
    json(res, 200, { message: 'Sessão encerrada.' });
  });

  route('get', '/api/pacientes/me', async (req, res) => json(res, 200, { user: publicUser(authenticated(req)) }));
  route('put', '/api/pacientes/me', async (req, res) => {
    const user = authenticated(req);
    const data = await readJson(req);
    validate(data, true);
    const merged = Object.fromEntries(fields.map((name) => [name, data[name] ?? user[name] ?? '']));
    duplicate(merged, user.idPaciente);
    // Uma troca de senha revoga as sessões antigas; a sessão atual permanece válida.
    emTransacao(() => {
      pacientes.editar(user.idPaciente, merged);
      if (data.senhaPaciente !== undefined) {
        const current = hash(req.headers.authorization.slice(7));
        db.prepare('DELETE FROM sessao_paciente WHERE id_paciente = ? AND token_hash != ?').run(user.idPaciente, current);
        db.prepare('UPDATE sessao_paciente SET senha_fingerprint = ? WHERE token_hash = ?').run(fingerprint(user.idPaciente), current);
      }
    });
    json(res, 200, { user: publicUser(pacientes.buscarPorId(user.idPaciente)) });
  });
  route('delete', '/api/pacientes/me', async (req, res) => {
    const user = authenticated(req);
    pacientes.deletar(user.idPaciente); // as sessões são apagadas junto (ON DELETE CASCADE)
    await removePhoto(user.fotoPerfilPaciente);
    json(res, 200, { message: 'Conta excluída.' });
  });

  route('put', '/api/pacientes/:id/foto', async (req, res) => {
    const user = authenticated(req);
    const bytes = await body(req, 5 * 1024 * 1024 + 65536);
    let form;
    try {
      form = await new Request('http://localhost/upload', { method: 'POST', headers: { 'Content-Type': req.headers['content-type'] || '' }, body: bytes }).formData();
    } catch { throw fail(400, 'Envie a foto como multipart/form-data.'); }
    const file = form.get('foto');
    if (!file || typeof file === 'string' || !file.size) throw fail(400, 'Selecione uma foto.');
    if (file.size > 5 * 1024 * 1024) throw fail(413, 'A foto deve ter no máximo 5 MB.');
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ? 'jpg'
      : buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'png'
      : buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP' ? 'webp' : null;
    if (!ext) throw fail(400, 'Use uma imagem JPEG, PNG ou WebP.');
    const name = `${randomBytes(24).toString('hex')}.${ext}`;
    await mkdir(uploads, { recursive: true });
    await writeFile(path.join(uploads, name), buffer, { flag: 'wx' });
    const url = `/uploads/perfis/${name}`;
    try { pacientes.atualizarFoto(user.idPaciente, url); }
    catch (error) { await unlink(path.join(uploads, name)); throw error; }
    await removePhoto(user.fotoPerfilPaciente);
    json(res, 200, { fotoPerfilPaciente: url });
  });

  route('get', '/uploads/perfis/:file', async (req, res) => {
    const name = req.params.file;
    if (!/^[a-f0-9]{48}\.(jpg|png|webp)$/.test(name)) throw fail(404, 'Foto não encontrada.');
    let bytes;
    try { bytes = await readFile(path.join(uploads, name)); }
    catch (error) { if (error.code === 'ENOENT') throw fail(404, 'Foto não encontrada.'); throw error; }
    const mime = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[name.split('.').pop()];
    res.writeHead(200, { 'Content-Type': mime, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, max-age=3600' });
    res.end(bytes);
  });
}

async function removePhoto(url) {
  const name = url?.match(/^\/uploads\/perfis\/([a-f0-9]{48}\.(?:jpg|png|webp))$/)?.[1];
  if (name) await unlink(path.join(uploads, name)).catch(() => {});
}
