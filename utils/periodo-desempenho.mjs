// Filtros da aba "Desempenho" do admin (valem para todas as sub-abas):
//   ?periodo=hoje | 7d | 30d | personalizado   (padrão: 7d)
//   ?inicio=AAAA-MM-DD&fim=AAAA-MM-DD           (só com periodo=personalizado)
//   ?plataforma=app | web | todas               (padrão: todas)
//   ?farmacia=<id>                              (padrão: todas)
// As datas são do horário local do servidor ("hoje" começa à meia-noite).
// Devolve também o período ANTERIOR de mesmo tamanho, para o front mostrar
// "+12% vs. semana passada".
import { erro } from "./http.mjs";

const HORA_MS = 3600000;
const DIA_MS = 24 * HORA_MS;
const DIAS = { "7d": 7, "30d": 30 };

const meiaNoite = (ms) => {
  const data = new Date(ms);
  data.setHours(0, 0, 0, 0);
  return data.getTime();
};

function dataLocal(valor, campo) {
  const texto = String(valor ?? "");
  const [ano, mes, dia] = texto.split("-").map(Number);
  const data = new Date(ano, mes - 1, dia);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto) || data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) {
    throw erro(400, `${campo} deve estar no formato AAAA-MM-DD.`);
  }
  return data.getTime();
}

export function lerFiltros(url, agora = Date.now()) {
  const p = url.searchParams;
  const periodo = p.get("periodo") || "7d";
  let inicio;
  let fim = agora;

  if (periodo === "hoje") {
    inicio = meiaNoite(agora);
  } else if (DIAS[periodo]) {
    inicio = meiaNoite(agora) - (DIAS[periodo] - 1) * DIA_MS;
  } else if (periodo === "personalizado") {
    inicio = dataLocal(p.get("inicio"), "inicio");
    fim = Math.min(dataLocal(p.get("fim"), "fim") + DIA_MS, agora);
    if (fim <= inicio) throw erro(400, "O fim do período deve ser depois do início.");
    if (fim - inicio > 366 * DIA_MS) throw erro(400, "Escolha um período de até 1 ano.");
  } else {
    throw erro(400, "periodo deve ser hoje, 7d, 30d ou personalizado.");
  }

  const plataforma = p.get("plataforma") || "todas";
  if (!["app", "web", "todas"].includes(plataforma)) throw erro(400, "plataforma deve ser app, web ou todas.");

  const farmaciaTexto = p.get("farmacia");
  const farmacia = farmaciaTexto && farmaciaTexto !== "todas" ? Number(farmaciaTexto) : null;
  if (farmacia !== null && (!Number.isSafeInteger(farmacia) || farmacia <= 0)) throw erro(400, "farmacia inválida.");

  const duracao = fim - inicio;
  // gráficos: por hora até 2 dias, por dia acima disso
  const passo = duracao <= 2 * DIA_MS ? HORA_MS : DIA_MS;

  return {
    periodo,
    inicio,
    fim,
    anterior: { inicio: inicio - duracao, fim: inicio },
    plataforma: plataforma === "todas" ? null : plataforma,
    farmacia,
    passo,
    // texto da comparação nos cards ("vs. ontem", "vs. semana passada"...)
    comparacao: { hoje: "vs. ontem", "7d": "vs. 7 dias anteriores", "30d": "vs. 30 dias anteriores" }[periodo]
      ?? "vs. período anterior",
  };
}

// "AND plataforma = ? AND farmacia_id = ?" + parâmetros, só com o que foi filtrado
export function filtroSql(filtros, { plataforma = "plataforma", farmacia = "farmacia_id" } = {}) {
  const partes = [];
  const valores = [];
  if (filtros.plataforma && plataforma) {
    partes.push(`${plataforma} = ?`);
    valores.push(filtros.plataforma);
  }
  if (filtros.farmacia && farmacia) {
    partes.push(`${farmacia} = ?`);
    valores.push(filtros.farmacia);
  }
  return { sql: partes.map((parte) => ` AND ${parte}`).join(""), valores };
}

// Variação em % (null quando não dá para comparar)
export function variacao(atual, anterior) {
  if (!Number.isFinite(atual) || !Number.isFinite(anterior) || anterior === 0) return null;
  return Math.round(((atual - anterior) / anterior) * 1000) / 10;
}
