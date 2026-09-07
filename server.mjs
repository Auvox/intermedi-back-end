import { createServer } from "node:http";
import { Router } from "./router.mjs";

import remedioRoutes from './routes/remedio.routes.mjs'

const router = new Router();

remedioRoutes(router)

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
  const handle = router.find(req.method, url.pathname);
  if (handle) {
    await handle(req, res);
  } else {
    res.statusCode = 404;
     res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      error: "Nao encontrado"
    }));
  }
});

server.listen(3000, () => {
  console.log("Servidor: http://localhost:3000");
});
