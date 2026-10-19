import { createHash, randomUUID } from "node:crypto";
import db from "../database/database.mjs";
import { erro } from "../utils/http.mjs";
import { assinarJwt, verificarJwt } from "../utils/jwt.mjs";
import { verificarSenha } from "../utils/senha.mjs";

// Login da equipe (admin, gerente e funcionário): CPF + matrícula + senha.
// O login devolve um JWT; o jti do token aponta para uma linha de
// sessao_usuario, que o logout encerra.

export const PAPEIS = ["admin", "gerente", "funcionario"];

function horasDeSessao() {
  const horas = Number(process.env.JWT_EXPIRA_HORAS || 8);
  return Number.isFinite(horas) && horas > 0 && horas <= 24 * 30 ? horas : 8;
}

// Muda sempre que a senha muda -> sessões antigas deixam de valer
const fingerprint = (senhaHash) => createHash("sha256").update(String(senhaHash ?? "")).digest("hex");
const somenteDigitos = (valor) => String(valor ?? "").replace(/\D/g, "");
// CPF salvo com ou sem máscara ("111.111.111-11" ou "11111111111")
const cpfSemMascara = (coluna) => `replace(replace(replace(${coluna}, '.', ''), '-', ''), ' ', '')`;

const PESSOAS = {
  admin: {
    select: /*sql*/ `
      SELECT a.id_admin AS id, a.nome, a.email, a.cpf, a.matricula, a.senha_hash,
             NULL AS idFarmacia, NULL AS nomeFarmacia, NULL AS foto, NULL AS cargo
      FROM admin a`,
    alias: "a",
    id: "a.id_admin",
  },
  gerente: {
    select: /*sql*/ `
      SELECT g.id_gerente AS id, g.nome, g.email, g.cpf, g.matricula, g.senha_hash,
             g.id_farmacia AS idFarmacia, f.nome AS nomeFarmacia, g.foto, NULL AS cargo
      FROM gerente g
      INNER JOIN farmacia f ON f.id_farmacia = g.id_farmacia`,
    alias: "g",
    id: "g.id_gerente",
  },
  funcionario: {
    select: /*sql*/ `
      SELECT fu.id_funcionario AS id, fu.nome, fu.email, fu.cpf, fu.matricula, fu.senha_hash,
             fu.id_farmacia AS idFarmacia, f.nome AS nomeFarmacia, fu.foto, fu.cargo
      FROM funcionario fu
      INNER JOIN farmacia f ON f.id_farmacia = fu.id_farmacia`,
    alias: "fu",
    id: "fu.id_funcionario",
  },
};

// O que o front recebe sobre quem está logado (nunca a senha)
function usuarioPublico(papel, linha) {
  return {
    papel,
    id: Number(linha.id),
    nome: linha.nome,
    email: linha.email,
    cpf: linha.cpf,
    matricula: linha.matricula,
    idFarmacia: linha.idFarmacia == null ? null : Number(linha.idFarmacia),
    nomeFarmacia: linha.nomeFarmacia ?? null,
    foto: linha.foto ?? null,
    cargo: linha.cargo ?? null,
  };
}

export function buscarUsuario(papel, id) {
  const pessoa = PESSOAS[papel];
  if (!pessoa) return null;
  const linha = db.prepare(`${pessoa.select} WHERE ${pessoa.id} = ?`).get(id);
  return linha ? usuarioPublico(papel, linha) : null;
}

function buscarPorCredencial(cpf, matricula) {
  for (const papel of PAPEIS) {
    const { select, alias } = PESSOAS[papel];
    const linha = db.prepare(/*sql*/ `
      ${select}
      WHERE upper(${alias}.matricula) = ? AND ${cpfSemMascara(`${alias}.cpf`)} = ?
    `).get(matricula, cpf);
    if (linha) return { papel, linha };
  }
  return null;
}

// ---------------------------------------------------------------------
// Limite de tentativas (em memória): 10 erros em 15 min por IP e por CPF
// ---------------------------------------------------------------------
const JANELA_MS = 15 * 60 * 1000;
const LIMITE_ERROS = 10;
const tentativas = new Map();

function bloqueado(chave, agora) {
  const registro = tentativas.get(chave);
  if (!registro || agora - registro.desde > JANELA_MS) return false;
  return registro.erros >= LIMITE_ERROS;
}

function registrarErro(chave, agora) {
  const registro = tentativas.get(chave);
  if (!registro || agora - registro.desde > JANELA_MS) tentativas.set(chave, { erros: 1, desde: agora });
  else registro.erros += 1;
  if (tentativas.size > 10_000) {
    for (const [outra, dados] of tentativas) if (agora - dados.desde > JANELA_MS) tentativas.delete(outra);
  }
}

export function entrar({ cpf, matricula, senha } = {}, ip = "") {
  if (typeof cpf !== "string" || typeof matricula !== "string" || typeof senha !== "string") {
    throw erro(400, "Informe CPF, matrícula e senha.");
  }
  const cpfDigitos = somenteDigitos(cpf);
  const matriculaNormalizada = matricula.trim().toUpperCase();
  if (cpfDigitos.length !== 11 || !matriculaNormalizada || !senha) {
    throw erro(400, "Informe CPF (11 dígitos), matrícula e senha.");
  }

  const agora = Date.now();
  const chaves = [`ip:${ip}`, `cpf:${cpfDigitos}`];
  if (chaves.some((chave) => bloqueado(chave, agora))) {
    throw erro(429, "Muitas tentativas de login. Aguarde 15 minutos e tente de novo.");
  }

  const achado = buscarPorCredencial(cpfDigitos, matriculaNormalizada);
  // verificarSenha usa um hash falso quando não achou ninguém: mesmo tempo nos dois casos
  if (!verificarSenha(senha, achado?.linha.senha_hash)) {
    chaves.forEach((chave) => registrarErro(chave, agora));
    throw erro(401, "CPF, matrícula ou senha incorretos.");
  }
  tentativas.delete(`cpf:${cpfDigitos}`);

  return criarSessao(achado.papel, achado.linha, agora);
}

function criarSessao(papel, linha, agora) {
  const expiraEm = agora + horasDeSessao() * 60 * 60 * 1000;
  const jti = randomUUID();
  const usuario = usuarioPublico(papel, linha);

  db.prepare("DELETE FROM sessao_usuario WHERE expira_em <= ?").run(agora);
  db.prepare(/*sql*/ `
    INSERT INTO sessao_usuario (jti, papel, id_usuario, senha_fingerprint, criada_em, expira_em)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(jti, papel, usuario.id, fingerprint(linha.senha_hash), agora, expiraEm);

  const token = assinarJwt({
    sub: `${papel}:${usuario.id}`,
    papel,
    id: usuario.id,
    idFarmacia: usuario.idFarmacia,
    jti,
    iat: Math.floor(agora / 1000),
    exp: Math.floor(expiraEm / 1000),
  });

  return { token, expiraEm: new Date(expiraEm).toISOString(), usuario };
}

export function tokenDaRequisicao(req) {
  return req.headers.authorization?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? null;
}

// Confere o JWT e a sessão. Devolve { usuario, jti } ou null.
// Os dados (papel, farmácia) vêm do banco, não do token: quem mudou de
// farmácia ou foi apagado deixa de ter acesso na hora.
export function autenticar(token) {
  const dados = verificarJwt(token);
  if (!dados || !PAPEIS.includes(dados.papel) || !Number.isSafeInteger(dados.id) || typeof dados.jti !== "string") {
    return null;
  }

  const sessao = db.prepare(/*sql*/ `
    SELECT papel, id_usuario, senha_fingerprint FROM sessao_usuario
    WHERE jti = ? AND encerrada_em IS NULL AND expira_em > ?
  `).get(dados.jti, Date.now());
  if (!sessao || sessao.papel !== dados.papel || sessao.id_usuario !== dados.id) return null;

  const { select, id } = PESSOAS[dados.papel];
  const linha = db.prepare(`${select} WHERE ${id} = ?`).get(dados.id);
  if (!linha || fingerprint(linha.senha_hash) !== sessao.senha_fingerprint) return null;

  return { usuario: usuarioPublico(dados.papel, linha), jti: dados.jti };
}

export function encerrarSessao(jti) {
  db.prepare("UPDATE sessao_usuario SET encerrada_em = ? WHERE jti = ? AND encerrada_em IS NULL")
    .run(Date.now(), jti);
}
