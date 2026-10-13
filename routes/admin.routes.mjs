import { 
    loginAdmin 
} from "../controller/admin.controller.mjs";

export function registrarRotasAdmin(router) {
  router.post("/admin/login", loginAdmin);
}