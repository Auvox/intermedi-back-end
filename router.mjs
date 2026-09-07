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

  find(method, pathname) {
    const routes = this.routes[method];

    if (!routes) {
      return null;
    }

    // Primeiro tenta encontrar uma rota exata
    if (routes[pathname]) {
      return routes[pathname];
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
        return (req, res) => {
          req.params = params;
          return routes[route](req, res);
        };
      }
    }

    return null;
  }
}
