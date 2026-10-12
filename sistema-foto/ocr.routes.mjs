import { reconhecerFotoRemedio } from "./ocr.controller.mjs";

export default function ocrRoutes(router) {
  // multipart/form-data, campo "foto"; não altera o catálogo.
  router.post("/remedios/reconhecer-foto", reconhecerFotoRemedio);
}
