import db from "../database/database.mjs";
import { erro } from "../utils/http.mjs";

// Mapa da rede (aba "Simulação em tempo real" do admin): as farmácias com o
// endereço e os pedidos entre farmácias com cada horário. O front monta o mapa
// em qualquer momento (ao vivo ou voltando no tempo) a partir desses horários.

const DIA_MS = 24 * 60 * 60 * 1000;
const paraSql = (ms) => new Date(ms).toISOString().slice(0, 19).replace("T", " ");
// datas do banco ("AAAA-MM-DD HH:MM:SS", UTC) -> ISO
const paraIso = (valor) => (valor ? `${String(valor).replace(" ", "T")}Z` : null);

export function mapaDaRede({ dias = 30, agora = Date.now() } = {}) {
  if (!Number.isInteger(dias) || dias < 1 || dias > 365) throw erro(400, "Informe dias entre 1 e 365.");
  const desde = agora - dias * DIA_MS;

  const farmacias = db.prepare(/*sql*/ `
    SELECT f.id_farmacia AS idFarmacia, f.nome, e.bairro, e.cidade, e.uf, e.latitude, e.longitude
    FROM farmacia f
    LEFT JOIN endereco e ON e.id_endereco = f.id_endereco
    ORDER BY f.id_farmacia
  `).all();

  // do período + os que ainda estão em andamento, mesmo se pedidos antes
  const pedidos = db.prepare(/*sql*/ `
    SELECT r.id_redistribuicao AS idPedido, r.id_remedio AS idRemedio,
           rm.nome AS nomeRemedio, rm.dosagem AS dosagemRemedio,
           r.id_farmacia_origem AS idOrigem, r.id_farmacia_destino AS idDestino,
           r.quantidade, r.status,
           r.data_solicitacao AS solicitadoEm, r.data_aprovacao AS aprovadoEm,
           r.data_recusa AS recusadoEm, r.data_envio AS enviadoEm,
           r.data_prevista_chegada AS previstoEm, r.data_recebimento AS recebidoEm
    FROM redistribuicao r
    INNER JOIN remedio rm ON rm.id_remedio = r.id_remedio
    WHERE r.data_solicitacao >= ? OR r.status IN ('aprovada', 'preparando', 'enviada')
    ORDER BY r.data_solicitacao, r.id_redistribuicao
  `).all(paraSql(desde));

  const datas = ["solicitadoEm", "aprovadoEm", "recusadoEm", "enviadoEm", "previstoEm", "recebidoEm"];
  return {
    agora: new Date(agora).toISOString(),
    desde: new Date(desde).toISOString(),
    farmacias,
    pedidos: pedidos.map((p) => ({ ...p, ...Object.fromEntries(datas.map((d) => [d, paraIso(p[d])])) })),
  };
}
