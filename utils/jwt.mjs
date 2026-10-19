import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// JWT (HS256) com node:crypto, sem biblioteca externa.
// Formato: base64url(cabeçalho).base64url(dados).base64url(assinatura)

let segredoDaSessao = null;

// O segredo vem do .env (JWT_SECRET). Sem ele:
//   • em produção o servidor não sobe;
//   • em desenvolvimento usa um segredo aleatório, que muda a cada reinício
//     (todo mundo precisa entrar de novo).
export function segredoJwt() {
  const segredo = process.env.JWT_SECRET;
  if (segredo) {
    if (segredo.length < 32) throw new Error("JWT_SECRET precisa ter pelo menos 32 caracteres.");
    return segredo;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Defina JWT_SECRET no .env para usar o login em produção.");
  }
  if (!segredoDaSessao) {
    segredoDaSessao = randomBytes(48).toString("base64url");
    console.warn("JWT_SECRET não definido: usando um segredo temporário (as sessões caem ao reiniciar).");
  }
  return segredoDaSessao;
}

const base64url = (valor) => Buffer.from(valor).toString("base64url");
const assinatura = (conteudo, segredo) => createHmac("sha256", segredo).update(conteudo).digest();

export function assinarJwt(dados, segredo = segredoJwt()) {
  const cabecalho = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const corpo = base64url(JSON.stringify(dados));
  return `${cabecalho}.${corpo}.${assinatura(`${cabecalho}.${corpo}`, segredo).toString("base64url")}`;
}

function lerParte(parte) {
  try {
    const valor = JSON.parse(Buffer.from(parte, "base64url").toString("utf8"));
    return valor && typeof valor === "object" && !Array.isArray(valor) ? valor : null;
  } catch {
    return null;
  }
}

// Devolve os dados do token ou null (assinatura errada, alg diferente, expirado...)
export function verificarJwt(token, segredo = segredoJwt(), agoraSegundos = Math.floor(Date.now() / 1000)) {
  if (typeof token !== "string" || token.length > 4096) return null;
  const partes = token.split(".");
  if (partes.length !== 3) return null;

  const [cabecalho, corpo, recebida] = partes;
  // só aceita HS256 (bloqueia "alg: none" e troca de algoritmo)
  if (lerParte(cabecalho)?.alg !== "HS256") return null;

  const esperada = assinatura(`${cabecalho}.${corpo}`, segredo);
  const informada = Buffer.from(recebida, "base64url");
  if (informada.length !== esperada.length || !timingSafeEqual(informada, esperada)) return null;

  const dados = lerParte(corpo);
  if (!dados || typeof dados.exp !== "number" || dados.exp <= agoraSegundos) return null;
  return dados;
}
