import db, { emTransacao } from "../database/database.mjs";
import { erro } from "../utils/http.mjs";

// Desativar não apaga nada do banco: o cadastro continua nas listas (cinza,
// "Desativado") e o admin pode reativar. Quem está desativado não entra na
// plataforma; farmácia desativada barra o login de todos os gerentes e
// funcionários dela.

const TIPOS = {
  farmacia: { tabela: "farmacia", id: "id_farmacia", rotulo: "Farmácia" },
  gerente: { tabela: "gerente", id: "id_gerente", rotulo: "Gerente" },
  funcionario: { tabela: "funcionario", id: "id_funcionario", rotulo: "Funcionário" },
  paciente: { tabela: "paciente", id: "id_paciente", rotulo: "Paciente" },
};

function tipoValido(tipo) {
  const config = TIPOS[tipo];
  if (!config) throw new Error(`Tipo de cadastro desconhecido: ${tipo}`);
  return config;
}

export function situacao(tipo, id) {
  const { tabela, id: coluna } = tipoValido(tipo);
  const linha = db.prepare(`SELECT ativo, desativado_em AS desativadoEm FROM ${tabela} WHERE ${coluna} = ?`).get(id);
  return linha ? { ativo: linha.ativo === 1, desativadoEm: linha.desativadoEm ?? null } : null;
}

// Encerra as sessões abertas de quem foi desativado (o próximo pedido cai no login)
function encerrarSessoes(tipo, id) {
  const agora = Date.now();
  if (tipo === "paciente") {
    db.prepare("DELETE FROM sessao_paciente WHERE id_paciente = ?").run(id);
    return;
  }
  if (tipo === "farmacia") {
    db.prepare(/*sql*/ `
      UPDATE sessao_usuario SET encerrada_em = ?
      WHERE encerrada_em IS NULL AND (
        (papel = 'gerente' AND id_usuario IN (SELECT id_gerente FROM gerente WHERE id_farmacia = ?)) OR
        (papel = 'funcionario' AND id_usuario IN (SELECT id_funcionario FROM funcionario WHERE id_farmacia = ?))
      )
    `).run(agora, id, id);
    return;
  }
  db.prepare("UPDATE sessao_usuario SET encerrada_em = ? WHERE papel = ? AND id_usuario = ? AND encerrada_em IS NULL")
    .run(agora, tipo, id);
}

function alterar(tipo, id, ativo) {
  const { tabela, id: coluna, rotulo } = tipoValido(tipo);
  return emTransacao(() => {
    const atual = situacao(tipo, id);
    if (!atual) throw erro(404, `${rotulo} não encontrado(a).`);
    db.prepare(`UPDATE ${tabela} SET ativo = ?, desativado_em = ? WHERE ${coluna} = ?`)
      .run(ativo ? 1 : 0, ativo ? null : new Date().toISOString(), id);
    if (!ativo) encerrarSessoes(tipo, id);
    return situacao(tipo, id);
  });
}

export const desativar = (tipo, id) => alterar(tipo, id, false);
export const reativar = (tipo, id) => alterar(tipo, id, true);
