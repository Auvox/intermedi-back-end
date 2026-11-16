// Cores do e-mail de boas-vindas: a mesma cor de destaque da plataforma de
// quem foi cadastrado (front: src/styles/personaTheme.css e tokens.css).
//   admin → preto · gerente → verde · funcionário → azul
// O resto é papel claro e tinta quase preta, como uma carta.

const NEUTROS = {
  fundo: "#f4f2ed",      // papel em volta da carta
  cartao: "#ffffff",     // a carta
  borda: "#e4e1d9",      // contorno do crachá
  caixa: "#f6f5f1",      // fundo dos dados de acesso
  texto: "#1d1d1f",
  textoSuave: "#55555a",
  textoFraco: "#86868b",
};

const DESTAQUES = {
  admin: { primaria: "#1d1d1f", suave: "#ececf0", tinta: "#1d1d1f" },
  gerente: { primaria: "#16804a", suave: "#e9f5ee", tinta: "#0f5c34" },
  funcionario: { primaria: "#0071e3", suave: "#e8f2fd", tinta: "#0058b0" },
};

export function paletaDoPapel(papel) {
  return { ...NEUTROS, ...(DESTAQUES[papel] ?? DESTAQUES.gerente), textoSobrePrimaria: "#ffffff" };
}
