import "./utils/ambiente.mjs";
import { createServer } from "node:http";
import { Router } from "./router.mjs";

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
import { iniciarEntregas } from "./services/redistribuicao.service.mjs";
import { autorizar } from "./services/acesso.service.mjs";
import rotaRoutes from "./sistema-rota/rota.routes.mjs";
import { enviarErro } from "./utils/http.mjs";
import { segredoJwt } from "./utils/jwt.mjs";

// sem JWT_SECRET em produção o servidor não sobe (em dev, só avisa)
segredoJwt();

const router = new Router();

authRoutes(router);
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

// confere a cada 5s os remédios que já chegaram (tempo de entrega das redistribuições)
iniciarEntregas();

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, DELETE",
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

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
    // login e permissão de cada rota: services/acesso.service.mjs
    try {
      autorizar(req, `${req.method} ${rota.rota}`, rota.params);
    } catch (error) {
      enviarErro(res, error);
      return;
    }
    await rota.handler(req, res);
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
