import db from "../database/database.mjs";
import { agrupar, periodoPublico, serieCompleta, variacao } from "../utils/periodo.mjs";
import * as serviceFuncionario from "./funcionario.service.mjs";
import * as serviceGerente from "./gerente.service.mjs";
import * as serviceFarmacia from "./farmacia.service.mjs";
import * as serviceRemedio from "./remedio.service.mjs";
import * as servicePaciente from "./paciente.service.mjs";
import { listarDaFarmacia } from "./estoque.service.mjs";
import { processarChegadas } from "./redistribuicao.service.mjs";

// Resumos que aparecem quando o usuário clica em um item das listas:
// dados do cadastro + números do período (?periodo= ou ?de=&ate=).
// Todas as consultas usam parâmetros nomeados: $id, $de, $ate.

const STATUS_CHAMADO = ["pendente", "aceito", "em_andamento", "resolvido", "recusado", "cancelado"];
const PRIORIDADES = ["baixa", "media", "alta", "urgente"];
const TURNOS = ["manha", "tarde", "noite", "integral"];

const no = (coluna) => `date(${coluna}) BETWEEN $de AND $ate`;
const contarPor = (lista, linhas, campo) =>
  Object.fromEntries(lista.map((chave) => [chave, linhas.find((l) => l[campo] === chave)?.total ?? 0]));

// ---------------------------------------------------------------------
//  Blocos reaproveitados
// ---------------------------------------------------------------------

// Serviços (atendimentos) filtrados por funcionário, farmácia ou paciente.
// filtro: ex. "s.id_funcionario = $id"
function blocoServicos(filtro, id, periodo) {
  const p = { id, de: periodo.de, ate: periodo.ate };
  const totais = db.prepare(/*sql*/ `
    SELECT COUNT(DISTINCT s.id_servico)       AS total,
           COUNT(DISTINCT s.id_paciente)      AS pacientesAtendidos,
           COALESCE(SUM(sr.quantidade), 0)    AS unidadesEntregues
    FROM servico s LEFT JOIN servico_remedio sr ON sr.id_servico = s.id_servico
    WHERE ${filtro} AND ${no("s.data_servico")}
  `).get(p);
  const { total: totalAnterior } = db.prepare(/*sql*/ `
    SELECT COUNT(*) AS total FROM servico s WHERE ${filtro} AND ${no("s.data_servico")}
  `).get({ id, ...periodo.anterior });

  const serie = db.prepare(/*sql*/ `
    SELECT ${agrupar(periodo, "s.data_servico")} AS periodo,
           COUNT(DISTINCT s.id_servico)    AS total,
           COALESCE(SUM(sr.quantidade), 0) AS unidades
    FROM servico s LEFT JOIN servico_remedio sr ON sr.id_servico = s.id_servico
    WHERE ${filtro} AND ${no("s.data_servico")}
    GROUP BY 1
  `).all(p);

  const topRemedios = db.prepare(/*sql*/ `
    SELECT r.id_remedio AS idRemedio, r.nome AS nomeRemedio, r.dosagem AS dosagemRemedio,
           r.foto AS fotoRemedio, SUM(sr.quantidade) AS quantidade, COUNT(DISTINCT s.id_servico) AS atendimentos
    FROM servico s
    INNER JOIN servico_remedio sr ON sr.id_servico = s.id_servico
    INNER JOIN remedio r          ON r.id_remedio  = sr.id_remedio
    WHERE ${filtro} AND ${no("s.data_servico")}
    GROUP BY r.id_remedio ORDER BY quantidade DESC, r.nome LIMIT 5
  `).all(p);

  const ultimos = db.prepare(/*sql*/ `
    SELECT s.id_servico AS idServico, s.data_servico AS dataServico, s.observacao,
           p.id_paciente AS idPaciente, p.nome AS nomePaciente,
           fu.id_funcionario AS idFuncionario, fu.nome AS nomeFuncionario,
           fa.id_farmacia AS idFarmacia, fa.nome AS nomeFarmacia,
           (SELECT COUNT(*) FROM servico_remedio x WHERE x.id_servico = s.id_servico) AS totalMedicamentos,
           (SELECT COALESCE(SUM(x.quantidade), 0) FROM servico_remedio x WHERE x.id_servico = s.id_servico) AS quantidadeTotal
    FROM servico s
    INNER JOIN paciente p     ON p.id_paciente     = s.id_paciente
    INNER JOIN funcionario fu ON fu.id_funcionario = s.id_funcionario
    INNER JOIN farmacia fa    ON fa.id_farmacia    = s.id_farmacia
    WHERE ${filtro} AND ${no("s.data_servico")}
    ORDER BY s.data_servico DESC, s.id_servico DESC LIMIT 5
  `).all(p);

  return {
    ...totais,
    totalAnterior,
    variacao: variacao(totais.total, totalAnterior),
    serie: serieCompleta(periodo, serie, ["total", "unidades"]),
    topRemedios,
    ultimos,
  };
}

// Chamados filtrados por funcionário (quem pediu) ou farmácia.
// filtro: ex. "ch.id_funcionario = $id"
function blocoChamados(filtro, id, periodo) {
  const p = { id, de: periodo.de, ate: periodo.ate };
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM chamado ch WHERE ${filtro} AND ${no("ch.data_abertura")}`).get(p);
  const { total: totalAnterior } = db.prepare(
    `SELECT COUNT(*) AS total FROM chamado ch WHERE ${filtro} AND ${no("ch.data_abertura")}`,
  ).get({ id, ...periodo.anterior });

  const porStatus = db.prepare(/*sql*/ `
    SELECT status, COUNT(*) AS total FROM chamado ch WHERE ${filtro} AND ${no("ch.data_abertura")} GROUP BY status
  `).all(p);
  const porPrioridade = db.prepare(/*sql*/ `
    SELECT prioridade, COUNT(*) AS total FROM chamado ch WHERE ${filtro} AND ${no("ch.data_abertura")} GROUP BY prioridade
  `).all(p);
  const serie = db.prepare(/*sql*/ `
    SELECT ${agrupar(periodo, "ch.data_abertura")} AS periodo, COUNT(*) AS total
    FROM chamado ch WHERE ${filtro} AND ${no("ch.data_abertura")} GROUP BY 1
  `).all(p);
  const { unidades } = db.prepare(/*sql*/ `
    SELECT COALESCE(SUM(cr.quantidade), 0) AS unidades
    FROM chamado ch INNER JOIN chamado_remedio cr ON cr.id_chamado = ch.id_chamado
    WHERE ${filtro} AND ${no("ch.data_abertura")}
  `).get(p);

  const ultimos = db.prepare(/*sql*/ `
    SELECT ch.id_chamado AS idChamado, ch.titulo, ch.status, ch.prioridade, ch.data_abertura AS dataAbertura,
           fu.id_funcionario AS idFuncionario, fu.nome AS nomeFuncionario,
           (SELECT COUNT(*) FROM chamado_remedio x WHERE x.id_chamado = ch.id_chamado) AS totalRemedios
    FROM chamado ch INNER JOIN funcionario fu ON fu.id_funcionario = ch.id_funcionario
    WHERE ${filtro} AND ${no("ch.data_abertura")}
    ORDER BY ch.data_abertura DESC, ch.id_chamado DESC LIMIT 5
  `).all(p);

  return {
    total,
    totalAnterior,
    variacao: variacao(total, totalAnterior),
    unidadesSolicitadas: unidades,
    porStatus: contarPor(STATUS_CHAMADO, porStatus, "status"),
    porPrioridade: contarPor(PRIORIDADES, porPrioridade, "prioridade"),
    serie: serieCompleta(periodo, serie),
    ultimos,
  };
}

// Pedidos entre farmácias (redistribuição) de uma farmácia
function blocoRede(idFarmacia, periodo, idGerente = null) {
  const p = { id: idFarmacia, de: periodo.de, ate: periodo.ate };
  const comoFornecedora = db.prepare(/*sql*/ `
    SELECT COUNT(*) AS total,
           SUM(status IN ('aprovada', 'enviada', 'recebida')) AS aceitos,
           SUM(status = 'recusada')                           AS recusados,
           COALESCE(SUM(CASE WHEN status IN ('enviada', 'recebida') THEN quantidade END), 0) AS unidadesEnviadas
    FROM redistribuicao WHERE id_farmacia_origem = $id AND ${no("data_solicitacao")}
  `).get(p);
  const comoSolicitante = db.prepare(/*sql*/ `
    SELECT COUNT(*) AS total,
           SUM(status = 'recebida')   AS entregues,
           SUM(status = 'enviada')    AS aCaminho,
           SUM(status = 'solicitada') AS aguardando,
           SUM(status = 'recusada')   AS recusados,
           COALESCE(SUM(CASE WHEN status = 'recebida' THEN quantidade END), 0) AS unidadesRecebidas
    FROM redistribuicao WHERE id_farmacia_destino = $id AND ${no("data_solicitacao")}
  `).get(p);
  const { pendentesAgora } = db.prepare(/*sql*/ `
    SELECT COUNT(*) AS pendentesAgora FROM redistribuicao WHERE id_farmacia_origem = ? AND status = 'solicitada'
  `).get(idFarmacia);

  const zerar = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v ?? 0]));
  const resultado = {
    comoFornecedora: { ...zerar(comoFornecedora), pendentesAgora },
    comoSolicitante: zerar(comoSolicitante),
  };
  if (idGerente) {
    resultado.comoFornecedora.respondidosPorEle = db.prepare(/*sql*/ `
      SELECT COUNT(*) AS total FROM redistribuicao
      WHERE id_gerente_resposta = $idGerente AND ${no("data_solicitacao")}
    `).get({ idGerente, de: periodo.de, ate: periodo.ate }).total;
  }
  return resultado;
}

// Funcionários de uma farmácia com a produção no período (ranking)
function equipe(idFarmacia, periodo) {
  const lista = db.prepare(/*sql*/ `
    SELECT fu.id_funcionario AS idFuncionario, fu.nome AS nomeFuncionario, fu.cargo AS cargoFuncionario,
           fu.turno AS turnoFuncionario, fu.foto AS fotoFuncionario, fu.matricula AS matriculaFuncionario,
           (SELECT COUNT(*) FROM servico s WHERE s.id_funcionario = fu.id_funcionario AND ${no("s.data_servico")}) AS servicos,
           (SELECT COUNT(*) FROM chamado ch WHERE ch.id_funcionario = fu.id_funcionario AND ${no("ch.data_abertura")}) AS chamados
    FROM funcionario fu WHERE fu.id_farmacia = $id
    ORDER BY servicos DESC, fu.nome
  `).all({ id: idFarmacia, de: periodo.de, ate: periodo.ate });

  return {
    total: lista.length,
    porTurno: Object.fromEntries(TURNOS.map((t) => [t, lista.filter((f) => f.turnoFuncionario === t).length])),
    lista,
  };
}

function resumoEstoque(idFarmacia) {
  const { resumo, estoque } = listarDaFarmacia(idFarmacia);
  return {
    ...resumo,
    unidades: estoque.reduce((total, item) => total + item.quantidade, 0),
    // o que precisa de atenção primeiro: vencidos, zerados e críticos
    atencao: estoque
      .filter((item) => item.vencido || item.critico)
      .sort((a, b) => b.vencido - a.vencido || a.quantidade - b.quantidade)
      .slice(0, 5)
      .map(({ idRemedio, nomeRemedio, dosagemRemedio, fotoRemedio, quantidade, estoqueMinimo, situacao, vencido, validade }) =>
        ({ idRemedio, nomeRemedio, dosagemRemedio, fotoRemedio, quantidade, estoqueMinimo, situacao, vencido, validade })),
  };
}

// ---------------------------------------------------------------------
//  Resumos
// ---------------------------------------------------------------------

export function funcionario(id, periodo) {
  const dados = serviceFuncionario.buscarPorId(id);
  if (!dados) return null;
  processarChegadas();

  const cadastradoPor = dados.idGerenteCadastro && db.prepare(/*sql*/ `
    SELECT id_gerente AS idGerente, nome AS nomeGerente, foto AS fotoGerente FROM gerente WHERE id_gerente = ?
  `).get(dados.idGerenteCadastro);
  const geral = db.prepare(/*sql*/ `
    SELECT (SELECT COUNT(*) FROM servico WHERE id_funcionario = $id) AS servicos,
           (SELECT COUNT(*) FROM chamado WHERE id_funcionario = $id) AS chamados,
           (SELECT MAX(data_servico) FROM servico WHERE id_funcionario = $id) AS ultimoServico
  `).get({ id });

  return {
    funcionario: dados,
    cadastradoPor: cadastradoPor || null,
    periodo: periodoPublico(periodo),
    servicos: blocoServicos("s.id_funcionario = $id", id, periodo),
    chamados: blocoChamados("ch.id_funcionario = $id", id, periodo),
    totaisGerais: geral,
  };
}

export function gerente(id, periodo) {
  const dados = serviceGerente.buscarPorId(id);
  if (!dados) return null;
  processarChegadas();
  const idFarmacia = dados.fkIdFarmacia;
  const p = { id, de: periodo.de, ate: periodo.ate };

  const cadastradoPor = dados.idAdminCadastro && db.prepare(
    "SELECT id_admin AS idAdmin, nome AS nomeAdmin FROM admin WHERE id_admin = ?",
  ).get(dados.idAdminCadastro);

  // decisões do gerente sobre os chamados da equipe
  const respostas = db.prepare(/*sql*/ `
    SELECT COUNT(*) AS total,
           SUM(status <> 'recusado') AS aceitos,
           SUM(status = 'recusado')  AS recusados,
           ROUND(AVG((julianday(data_resposta) - julianday(data_abertura)) * 1440)) AS tempoMedioRespostaMin
    FROM chamado WHERE id_gerente_resposta = $id AND ${no("data_resposta")}
  `).get(p);
  const { pendentesAgora } = db.prepare(
    "SELECT COUNT(*) AS pendentesAgora FROM chamado WHERE id_farmacia = ? AND status = 'pendente'",
  ).get(idFarmacia);
  const cadastros = db.prepare(/*sql*/ `
    SELECT (SELECT COUNT(*) FROM funcionario WHERE id_gerente_cadastro = $id) AS funcionarios,
           (SELECT COUNT(*) FROM estoque WHERE id_gerente_cadastro = $id)     AS itensEstoque
  `).get({ id });

  return {
    gerente: dados,
    cadastradoPor: cadastradoPor || null,
    farmacia: { idFarmacia, nomeFarmacia: dados.nomeFarmacia },
    periodo: periodoPublico(periodo),
    chamadosRespondidos: {
      total: respostas.total,
      aceitos: respostas.aceitos ?? 0,
      recusados: respostas.recusados ?? 0,
      tempoMedioRespostaMin: respostas.tempoMedioRespostaMin,
      pendentesAgora,
    },
    chamadosDaFarmacia: blocoChamados("ch.id_farmacia = $id", idFarmacia, periodo),
    rede: blocoRede(idFarmacia, periodo, id),
    equipe: equipe(idFarmacia, periodo),
    cadastradosPorEle: cadastros,
    estoque: resumoEstoque(idFarmacia),
    servicosDaFarmacia: blocoServicos("s.id_farmacia = $id", idFarmacia, periodo),
  };
}

export function farmacia(id, periodo) {
  const dados = serviceFarmacia.buscarPorId(id);
  if (!dados) return null;
  processarChegadas();

  const gerentes = db.prepare(/*sql*/ `
    SELECT id_gerente AS idGerente, nome AS nomeGerente, email AS emailGerente, telefone AS telGerente,
           matricula AS matriculaGerente, crf AS crfGerente, foto AS fotoGerente
    FROM gerente WHERE id_farmacia = ? ORDER BY nome
  `).all(id);

  return {
    farmacia: dados,
    periodo: periodoPublico(periodo),
    gerentes,
    funcionarios: equipe(id, periodo),
    estoque: resumoEstoque(id),
    servicos: blocoServicos("s.id_farmacia = $id", id, periodo),
    chamados: blocoChamados("ch.id_farmacia = $id", id, periodo),
    rede: blocoRede(id, periodo),
  };
}

export function remedio(id, periodo) {
  const dados = serviceRemedio.buscarPorId(id);
  if (!dados) return null;
  processarChegadas();
  const p = { id, de: periodo.de, ate: periodo.ate };

  const farmacias = db.prepare(/*sql*/ `
    SELECT f.id_farmacia AS idFarmacia, f.nome AS nomeFarmacia, es.quantidade, es.estoque_minimo AS estoqueMinimo,
           es.lote, es.validade,
           (es.validade IS NOT NULL AND es.validade < date('now', 'localtime')) AS vencido
    FROM estoque es INNER JOIN farmacia f ON f.id_farmacia = es.id_farmacia
    WHERE es.id_remedio = ? ORDER BY es.quantidade DESC, f.nome
  `).all(id).map((f) => ({
    ...f,
    vencido: Boolean(f.vencido),
    situacao: f.quantidade === 0 ? "zerado" : f.quantidade <= f.estoqueMinimo ? "critico" : "ok",
  }));

  const servicos = db.prepare(/*sql*/ `
    SELECT COUNT(DISTINCT s.id_servico) AS atendimentos, COUNT(DISTINCT s.id_paciente) AS pacientes,
           COALESCE(SUM(sr.quantidade), 0) AS unidadesEntregues
    FROM servico_remedio sr INNER JOIN servico s ON s.id_servico = sr.id_servico
    WHERE sr.id_remedio = $id AND ${no("s.data_servico")}
  `).get(p);
  const { unidades: unidadesAnterior } = db.prepare(/*sql*/ `
    SELECT COALESCE(SUM(sr.quantidade), 0) AS unidades
    FROM servico_remedio sr INNER JOIN servico s ON s.id_servico = sr.id_servico
    WHERE sr.id_remedio = $id AND ${no("s.data_servico")}
  `).get({ id, ...periodo.anterior });
  const serie = db.prepare(/*sql*/ `
    SELECT ${agrupar(periodo, "s.data_servico")} AS periodo, SUM(sr.quantidade) AS unidades,
           COUNT(DISTINCT s.id_servico) AS total
    FROM servico_remedio sr INNER JOIN servico s ON s.id_servico = sr.id_servico
    WHERE sr.id_remedio = $id AND ${no("s.data_servico")} GROUP BY 1
  `).all(p);
  const porFarmacia = db.prepare(/*sql*/ `
    SELECT f.id_farmacia AS idFarmacia, f.nome AS nomeFarmacia, SUM(sr.quantidade) AS unidades
    FROM servico_remedio sr
    INNER JOIN servico s  ON s.id_servico  = sr.id_servico
    INNER JOIN farmacia f ON f.id_farmacia = s.id_farmacia
    WHERE sr.id_remedio = $id AND ${no("s.data_servico")}
    GROUP BY f.id_farmacia ORDER BY unidades DESC
  `).all(p);

  const chamados = db.prepare(/*sql*/ `
    SELECT COUNT(DISTINCT ch.id_chamado) AS total, COALESCE(SUM(cr.quantidade), 0) AS unidadesSolicitadas,
           COUNT(DISTINCT ch.id_farmacia) AS farmacias
    FROM chamado_remedio cr INNER JOIN chamado ch ON ch.id_chamado = cr.id_chamado
    WHERE cr.id_remedio = $id AND ${no("ch.data_abertura")}
  `).get(p);
  const redistribuicoes = db.prepare(/*sql*/ `
    SELECT COUNT(*) AS total,
           COALESCE(SUM(CASE WHEN status IN ('enviada', 'recebida') THEN quantidade END), 0) AS unidadesMovimentadas,
           SUM(status = 'recusada') AS recusadas
    FROM redistribuicao WHERE id_remedio = $id AND ${no("data_solicitacao")}
  `).get(p);

  return {
    remedio: dados,
    periodo: periodoPublico(periodo),
    rede: {
      farmaciasComCadastro: farmacias.length,
      farmaciasComEstoque: farmacias.filter((f) => f.quantidade > 0 && !f.vencido).length,
      unidadesNaRede: farmacias.reduce((total, f) => total + f.quantidade, 0),
      farmacias,
    },
    servicos: {
      ...servicos,
      unidadesAnterior,
      variacao: variacao(servicos.unidadesEntregues, unidadesAnterior),
      serie: serieCompleta(periodo, serie, ["total", "unidades"]),
      porFarmacia,
    },
    chamados,
    redistribuicoes: { ...redistribuicoes, recusadas: redistribuicoes.recusadas ?? 0 },
  };
}

export function paciente(id, periodo) {
  const dados = servicePaciente.buscarPorId(id);
  if (!dados) return null;

  const farmacias = db.prepare(/*sql*/ `
    SELECT f.id_farmacia AS idFarmacia, f.nome AS nomeFarmacia, COUNT(*) AS atendimentos,
           MAX(s.data_servico) AS ultimoAtendimento
    FROM servico s INNER JOIN farmacia f ON f.id_farmacia = s.id_farmacia
    WHERE s.id_paciente = ? GROUP BY f.id_farmacia ORDER BY atendimentos DESC
  `).all(id);
  const geral = db.prepare(/*sql*/ `
    SELECT COUNT(*) AS servicos, MIN(data_servico) AS primeiroAtendimento, MAX(data_servico) AS ultimoAtendimento
    FROM servico WHERE id_paciente = ?
  `).get(id);

  const { pacientesAtendidos, ...servicos } = blocoServicos("s.id_paciente = $id", id, periodo);
  return {
    paciente: dados,
    periodo: periodoPublico(periodo),
    servicos,
    farmacias,
    totaisGerais: geral,
  };
}
