import {
  acessosDoFuncionario,
  acessosDoGerente,
  entrar,
  presenca,
  quemSouEu,
  sair,
} from "../controller/auth.controller.mjs";

// Login da equipe (admin, gerente e funcionário) com JWT.
// O app do paciente usa /api/auth/* (routes/app.routes.mjs).
export default function authRoutes(router) {
  router.post("/auth/login", entrar);

  router.get("/auth/me", quemSouEu);

  router.post("/auth/logout", sair);

  // tempo logado: o front avisa que a pessoa segue na plataforma...
  router.post("/auth/presenca", presenca);
  // ...e o gerente (equipe) e o admin (todos) consultam
  router.get("/funcionario/:id/acessos", acessosDoFuncionario);
  router.get("/gerente/:id/acessos", acessosDoGerente);
}
