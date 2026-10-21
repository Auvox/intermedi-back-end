import "./utils/ambiente.mjs";
import { createServer } from "node:http";
import { Router } from "./router.mjs";

import { registrarRotasAdmin } from "./routes/admin.routes.mjs";
import remedioRoutes from "./routes/remedio.routes.mjs";
import farmaciaRoutes from "./routes/farmacia.routes.mjs";
import funcionarioRoutes from "./routes/funcionario.routes.mjs";
import gerenteRoutes from "./routes/gerente.routes.mjs";
import pacienteRoutes from "./routes/paciente.routes.mjs";
import appRoutes from "./routes/app.routes.mjs";
import chamadoRoutes from "./routes/chamado.routes.mjs";
import estoqueRoutes from "./routes/estoque.routes.mjs";
import categoriaRoutes from "./routes/categoria.routes.mjs";
import redistribuicaoRoutes from "./routes/redistribuicao.routes.mjs";
import resumoRoutes from "./routes/resumo.routes.mjs";
import fotoRoutes from "./routes/foto.routes.mjs";
import authRoutes from "./routes/auth.routes.mjs";
import analyticsRoutes from "./routes/analytics.routes.mjs";
import { iniciarEntregas } from "./services/redistribuicao.service.mjs";
import { autorizar } from "./services/acesso.service.mjs";
import { iniciarMonitor, plataformaDaRequisicao, registrarErro, registrarRequisicao } from "./services/monitor.service.mjs";
import { performance } from "node:perf_hooks";
import rotaRoutes from "./sistema-rota/rota.routes.mjs";
import ocrRoutes from "./sistema-foto/ocr.routes.mjs";
import { enviarErro } from "./utils/http.mjs";
import { segredoJwt } from "./utils/jwt.mjs";

// sem JWT_SECRET em produção o servidor não sobe (em dev, só avisa)
segredoJwt();

const router = new Router();

authRoutes(router);
registrarRotasAdmin(router);
remedioRoutes(router);
farmaciaRoutes(router);
funcionarioRoutes(router);
gerenteRoutes(router);
pacienteRoutes(router);
appRoutes(router);
chamadoRoutes(router);
estoqueRoutes(router);
categoriaRoutes(router);
redistribuicaoRoutes(router);
resumoRoutes(router);
fotoRoutes(router);
rotaRoutes(router);
ocrRoutes(router);
analyticsRoutes(router);

// confere a cada 5s os remédios que já chegaram (tempo de entrega das redistribuições)
iniciarEntregas();
// saúde do sistema: grava as requisições e verifica os alertas a cada 1 minuto
iniciarMonitor();

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, DELETE",
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Intermedi-Plataforma");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, "http://localhost");
  console.log(req.method, url.pathname);
  const rota = router.match(req.method, url.pathname);
  if (rota) {
    req.params = rota.params;
    // registra cada requisição para a aba Desempenho (rota, status e tempo)
    const inicio = performance.now();
    res.on("finish", () => {
      registrarRequisicao({
        rota: rota.rota,
        metodo: req.method,
        status: res.statusCode,
        duracaoMs: performance.now() - inicio,
        usuario: req.usuario ? `${req.usuario.papel}:${req.usuario.id}` : null,
        plataforma: plataformaDaRequisicao(req, url.pathname),
      });
      if (res.statusCode >= 500) {
        registrarErro({ error: res.erroOriginal ?? `Resposta ${res.statusCode}`, rota: rota.rota, metodo: req.method });
      }
    });
    // login e permissão de cada rota: services/acesso.service.mjs
    try {
      autorizar(req, `${req.method} ${rota.rota}`, rota.params);
    } catch (error) {
      enviarErro(res, error);
      return;
    }
    try {
      await rota.handler(req, res);
    } catch (error) {
      // erro que o controller não tratou: responde 500 em vez de deixar a requisição pendurada
      if (!res.headersSent) enviarErro(res, error);
      else res.end();
    }
  } else {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "Nao encontrado",
      }),
    );
  }
});

const port = Number(process.env.PORT || 3000);
server.listen(port, process.env.HOST || '0.0.0.0', () => {
  console.log(`Servidor: http://localhost:${server.address().port}`);
});
