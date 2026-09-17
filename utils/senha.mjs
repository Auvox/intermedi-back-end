import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Formato salvo no banco: scrypt$<salt>$<hash>
// A senha pura NUNCA é salva, só esse texto.

export function gerarHashSenha(senha) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(senha), salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

// Hash "falso" usado quando o e-mail não existe, para o login
// demorar o mesmo tempo nos dois casos.
const HASH_FALSO = gerarHashSenha(randomBytes(8).toString("hex"));

export function verificarSenha(senha, armazenado) {
  const partes = typeof armazenado === "string" ? armazenado.split("$") : [];
  const [algoritmo, salt, hash] = partes.length === 3 ? partes : HASH_FALSO.split("$");

  const esperado = Buffer.from(hash, "hex");
  const calculado = scryptSync(String(senha ?? ""), salt, esperado.length);
  const confere = esperado.length === calculado.length && timingSafeEqual(esperado, calculado);

  return confere && partes.length === 3 && algoritmo === "scrypt";
}

// Senha provisória para quando o cadastro não informa senha
export function gerarSenhaProvisoria() {
  return randomBytes(6).toString("base64url");
}
