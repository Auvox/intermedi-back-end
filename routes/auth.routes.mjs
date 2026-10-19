import { entrar, quemSouEu, sair } from "../controller/auth.controller.mjs";

// Login da equipe (admin, gerente e funcionário) com JWT.
// O app do paciente usa /api/auth/* (routes/app.routes.mjs).
export default function authRoutes(router) {
  router.post("/auth/login", entrar);

  router.get("/auth/me", quemSouEu);

  router.post("/auth/logout", sair);
}
