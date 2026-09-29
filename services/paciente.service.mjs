import db, { emTransacao } from "../database/database.mjs";
import { erro } from "../utils/http.mjs";
import { mesclar, texto, textoOuNull } from "../utils/dados.mjs";
import { gerarHashSenha } from "../utils/senha.mjs";
import { colunasEndereco, lerEndereco, salvarEndereco } from "./endereco.service.mjs";

const CAMPOS_ENDERECO = {
  logradouro: "ruaPaciente",
  numero: "numeroPaciente",
  complemento: "complementoPaciente",
  bairro: "bairroPaciente",
  cidade: "cidadePaciente",
  uf: "estadoPaciente",
  cep: "cepPaciente",
};

// A senha (senha_hash) nunca sai no SELECT
const SELECT_PACIENTE = /*sql*/ `
  SELECT
      p.id_paciente           AS idPaciente,
      p.nome                  AS nomePaciente,
      p.cpf                   AS cpfPaciente,
      p.telefone              AS telPaciente,
      p.email                 AS emailPaciente,
      p.medicamento_frequente AS medicamentoFrequentePaciente,
      p.foto_perfil           AS fotoPerfilPaciente,
      p.created_at            AS createdAtPaciente,
      p.id_endereco           AS idEndereco,
      ${colunasEndereco({
        cep: "cepPaciente", logradouro: "ruaPaciente", numero: "numeroPaciente",
        bairro: "bairroPaciente", cidade: "cidadePaciente", uf: "estadoPaciente",
        complemento: "complementoPaciente",
      })}
  FROM paciente p
  LEFT JOIN endereco e ON e.id_endereco = p.id_endereco
`;

function validar(dados) {
  if (!texto(dados.nomePaciente) || !texto(dados.cpfPaciente)) {
    throw erro(400, "Informe nomePaciente e cpfPaciente.");
  }
}

// Cadastrar
export function cadastrar(data) {
  validar(data);
  const endereco = lerEndereco(data, CAMPOS_ENDERECO);
  const senha = texto(data.senhaPaciente);

  return emTransacao(() => {
    const idEndereco = salvarEndereco(null, endereco);

    const result = db.prepare(/* sql */ `
      INSERT INTO paciente
          (nome, cpf, telefone, email, senha_hash, medicamento_frequente, id_endereco)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      texto(data.nomePaciente),
      texto(data.cpfPaciente),
      textoOuNull(data.telPaciente),
      textoOuNull(data.emailPaciente),
      senha ? gerarHashSenha(senha) : null,
      textoOuNull(data.medicamentoFrequentePaciente),
      idEndereco,
    );

    return { idPaciente: Number(result.lastInsertRowid), idEndereco };
  });
}

// Listar
export function listar() {
  return db.prepare(`${SELECT_PACIENTE} ORDER BY p.nome`).all();
}

// Buscar individual
export function buscarPorId(id) {
  return db.prepare(`${SELECT_PACIENTE} WHERE p.id_paciente = ?`).get(id);
}

export function buscarPorTermo(termo) {
  const busca = `%${termo.trim().toLowerCase()}%`;

  return db.prepare(/*sql*/ `
    ${SELECT_PACIENTE}
    WHERE LOWER(p.nome) LIKE ? OR LOWER(p.email) LIKE ?
    ORDER BY p.nome ASC
    LIMIT 15
  `).all(busca, busca);
}

// Editar (campos não enviados continuam iguais; senha só muda se vier preenchida)
export function editar(id, data) {
  const atual = buscarPorId(id);
  if (!atual) return { changes: 0 };

  const dados = mesclar(atual, data);
  validar(dados);
  const endereco = lerEndereco(dados, CAMPOS_ENDERECO);
  const novaSenha = texto(data.senhaPaciente);

  return emTransacao(() => {
    const idEndereco = salvarEndereco(atual.idEndereco, endereco);

    const result = db.prepare(/* sql */ `
      UPDATE paciente
      SET nome = ?, cpf = ?, telefone = ?, email = ?,
          medicamento_frequente = ?, id_endereco = ?,
          senha_hash = COALESCE(?, senha_hash)
      WHERE id_paciente = ?
    `).run(
      texto(dados.nomePaciente),
      texto(dados.cpfPaciente),
      textoOuNull(dados.telPaciente),
      textoOuNull(dados.emailPaciente),
      textoOuNull(dados.medicamentoFrequentePaciente),
      idEndereco,
      novaSenha ? gerarHashSenha(novaSenha) : null,
      id,
    );

    return { changes: Number(result.changes) };
  });
}

// Deletar (as sessões do app caem junto, por ON DELETE CASCADE)
export function deletar(id) {
  return emTransacao(() => {
    const atual = db.prepare("SELECT id_endereco FROM paciente WHERE id_paciente = ?").get(id);
    if (!atual) return { changes: 0 };

    const result = db.prepare("DELETE FROM paciente WHERE id_paciente = ?").run(id);
    if (atual.id_endereco) salvarEndereco(atual.id_endereco, null);

    return { changes: Number(result.changes) };
  });
}

// ---------------------------------------------------------------------
//  Usado pelo login do app (routes/app.routes.mjs)
// ---------------------------------------------------------------------

// Retorna { idPaciente, senhaHash } — só para conferir a senha
export function buscarCredenciais(email) {
  return db.prepare(/* sql */ `
    SELECT id_paciente AS idPaciente, senha_hash AS senhaHash
    FROM paciente
    WHERE email = ?
  `).get(texto(email));
}

export function buscarSenhaHash(id) {
  return db.prepare("SELECT senha_hash FROM paciente WHERE id_paciente = ?").get(id)?.senha_hash;
}

export function atualizarFoto(id, url) {
  return db.prepare("UPDATE paciente SET foto_perfil = ? WHERE id_paciente = ?").run(url, id);
}

// E-mail (sem diferenciar maiúsculas) ou CPF (sem pontuação) já usados por outro paciente?
export function existeDuplicado(email, cpf, idIgnorar = -1) {
  return Boolean(db.prepare(/* sql */ `
    SELECT 1 FROM paciente
    WHERE id_paciente <> ?
      AND (email = ?
           OR replace(replace(cpf, '.', ''), '-', '') = replace(replace(?, '.', ''), '-', ''))
  `).get(idIgnorar, texto(email), texto(cpf)));
}
