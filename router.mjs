export class Router {
  routes = {
    GET: {},
    POST: {},
    PUT: {},
    DELETE: {},
  };

  get(path, handler) {
    this.routes.GET[path] = handler;
  }

  post(path, handler) {
    this.routes.POST[path] = handler;
  }

  put(path, handler) {
    this.routes.PUT[path] = handler;
  }

  delete(path, handler) {
    this.routes.DELETE[path] = handler;
  }

  // Encontra a rota cadastrada e os parâmetros da URL.
  // ex.: match("GET", "/gerente/2/estoque") -> { rota: "/gerente/:id/estoque", params: { id: "2" } }
  match(method, pathname) {
    const routes = this.routes[method];

    if (!routes) {
      return null;
    }

    // Primeiro tenta encontrar uma rota exata
    if (routes[pathname]) {
      return { rota: pathname, params: {}, handler: routes[pathname] };
    }

    // Procura rotas com parâmetro
    for (const route in routes) {
      const partsRoute = route.split("/");
      const partsPath = pathname.split("/");

      if (partsRoute.length !== partsPath.length) {
        continue;
      }

      const params = {};

      let match = true;

      for (let i = 0; i < partsRoute.length; i++) {
        if (partsRoute[i].startsWith(":")) {
          const nomeParametro = partsRoute[i].slice(1);
          params[nomeParametro] = partsPath[i];
        } else if (partsRoute[i] !== partsPath[i]) {
          match = false;
          break;
        }
      }

      if (match) {
        return { rota: route, params, handler: routes[route] };
      }
    }

    return null;
  }

  find(method, pathname) {
    const encontrada = this.match(method, pathname);
    if (!encontrada) return null;

    return (req, res) => {
      req.params = encontrada.params;
      return encontrada.handler(req, res);
    };
  }
}
