// Período dos resumos (perfil de funcionário, gerente, farmácia, remédio e paciente).
//   ?periodo=7d | 30d | 90d | 12m | tudo      (padrão: 30d)
//   ?de=AAAA-MM-DD&ate=AAAA-MM-DD            (tem prioridade sobre ?periodo)
// As datas do banco estão em UTC ("AAAA-MM-DD HH:MM:SS"); os filtros usam date(coluna).
import db from "../database/database.mjs";
import { erro } from "./http.mjs";
import { texto } from "./dados.mjs";

const PERIODOS = { "7d": 7, "30d": 30, "90d": 90, "12m": 365, tudo: null };
const ROTULOS = {
  "7d": "Últimos 7 dias", "30d": "Últimos 30 dias", "90d": "Últimos 90 dias",
  "12m": "Últimos 12 meses", tudo: "Todo o período",
};
const DIA_MS = 86400000;

const paraData = (ms) => new Date(ms).toISOString().slice(0, 10);
const emMs = (data) => Date.parse(`${data}T00:00:00Z`);

function dataValida(valor, campo) {
  const data = texto(valor);
  const ms = emMs(data);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(ms) || paraData(ms) !== data) {
    throw erro(400, `${campo} deve estar no formato AAAA-MM-DD.`);
  }
  return data;
}

// Primeira data com movimento no sistema (usado em ?periodo=tudo)
function primeiraData() {
  return db.prepare(/*sql*/ `
    SELECT MIN(d) AS d FROM (
      SELECT MIN(date(data_servico))     AS d FROM servico
      UNION ALL SELECT MIN(date(data_abertura))    FROM chamado
      UNION ALL SELECT MIN(date(data_solicitacao)) FROM redistribuicao)
  `).get()?.d;
}

// Lê o período da URL. Devolve também o período ANTERIOR de mesmo tamanho
// (para o front mostrar "+20% em relação ao período anterior").
export function lerPeriodo(req) {
  const params = new URL(req.url ?? "/", "http://localhost").searchParams;
  const hoje = paraData(Date.now());
  let de, ate, rotulo, chave = null;

  if (params.get("de") || params.get("ate")) {
    de = dataValida(params.get("de"), "de");
    ate = params.get("ate") ? dataValida(params.get("ate"), "ate") : hoje;
    if (de > ate) throw erro(400, "A data inicial (de) deve ser anterior à final (ate).");
    rotulo = "Período personalizado";
  } else {
    chave = texto(params.get("periodo")).toLowerCase() || "30d";
    if (!(chave in PERIODOS)) throw erro(400, `periodo inválido. Use: ${Object.keys(PERIODOS).join(", ")}.`);
    ate = hoje;
    de = PERIODOS[chave] === null
      ? (primeiraData() ?? hoje)
      : paraData(emMs(hoje) - (PERIODOS[chave] - 1) * DIA_MS);
    if (de > ate) de = ate;
    rotulo = ROTULOS[chave];
  }

  const dias = Math.round((emMs(ate) - emMs(de)) / DIA_MS) + 1;
  return {
    chave,
    rotulo,
    de,
    ate,
    dias,
    // até 62 dias o gráfico é por dia; acima disso, por mês
    agrupamento: dias <= 62 ? "dia" : "mes",
    anterior: {
      de: paraData(emMs(de) - dias * DIA_MS),
      ate: paraData(emMs(de) - DIA_MS),
    },
  };
}

// Expressão SQL que agrupa a coluna de data conforme o período
export const agrupar = (periodo, coluna) =>
  periodo.agrupamento === "dia" ? `date(${coluna})` : `strftime('%Y-%m', ${coluna})`;

// Preenche com zero os dias/meses sem movimento: [{ periodo: "2026-09-28", total: 3 }, ...]
export function serieCompleta(periodo, linhas, campos = ["total"]) {
  const porChave = new Map(linhas.map((linha) => [linha.periodo, linha]));
  const chaves = [];
  if (periodo.agrupamento === "dia") {
    for (let ms = emMs(periodo.de); ms <= emMs(periodo.ate); ms += DIA_MS) chaves.push(paraData(ms));
  } else {
    let [ano, mes] = periodo.de.slice(0, 7).split("-").map(Number);
    const fim = periodo.ate.slice(0, 7);
    for (;;) {
      const chave = `${ano}-${String(mes).padStart(2, "0")}`;
      chaves.push(chave);
      if (chave >= fim) break;
      mes += 1;
      if (mes > 12) { mes = 1; ano += 1; }
    }
  }
  return chaves.map((chave) => ({
    periodo: chave,
    ...Object.fromEntries(campos.map((campo) => [campo, porChave.get(chave)?.[campo] ?? 0])),
  }));
}

// Variação percentual entre o período atual e o anterior (null se não dá para comparar)
export const variacao = (atual, anterior) =>
  anterior ? Math.round(((atual - anterior) / anterior) * 100) : (atual ? null : 0);

// Só o que o front precisa do período (sem o objeto interno "chave")
export const periodoPublico = ({ chave, rotulo, de, ate, dias, agrupamento, anterior }) =>
  ({ periodo: chave, rotulo, de, ate, dias, agrupamento, anterior });
