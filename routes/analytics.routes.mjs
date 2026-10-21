import {
  receberCliques,
  pontosDoMapa,
  rankingRotas,
  resumoGeral,
  listarCapturas,
  enviarCaptura,
  exibirCaptura,
} from "../controller/analytics.controller.mjs";
import { painelSaude, listarAlertas, resolverAlerta, silenciarAlerta } from "../controller/saude.controller.mjs";

// Aba "Desempenho" do admin. Filtros (GET): ?periodo=hoje|7d|30d|personalizado
// &inicio=&fim=&plataforma=app|web|todas&farmacia=<id> (utils/periodo-desempenho.mjs)
// Quem pode chamar: services/acesso.service.mjs (só o admin, menos o envio dos cliques).
export default function analyticsRoutes(router) {
  // lote de cliques e visitas { cliques: [...], visitas: [...] } (web e app)
  router.post("/analytics/cliques", receberCliques);

  // pontos do mapa de calor: ?rota=&persona=&dispositivo= + filtros
  router.get("/analytics/cliques", pontosDoMapa);

  // ranking de telas: visitas, cliques, tempo médio e abandono
  router.get("/analytics/rotas", rankingRotas);

  // visão geral: 4 indicadores, gráficos e alertas ativos
  router.get("/analytics/resumo", resumoGeral);

  // capturas das telas do app (fundo do mapa de calor)
  router.get("/analytics/telas", listarCapturas);
  router.post("/analytics/telas", enviarCaptura);
  router.get("/uploads/telas/:arquivo", exibirCaptura);

  // saúde do sistema e alertas
  router.get("/saude", painelSaude);
  router.get("/alertas", listarAlertas);
  router.put("/alertas/:id/resolver", resolverAlerta);
  router.put("/alertas/:id/silenciar", silenciarAlerta);
}
