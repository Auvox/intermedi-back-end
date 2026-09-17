// Helpers para tratar os dados que chegam do front

// Converte para texto sem espaços nas pontas ("" quando não veio nada)
export function texto(valor) {
  return valor === undefined || valor === null ? "" : String(valor).trim();
}

// "" vira null (para colunas opcionais e UNIQUE, como e-mail)
export function textoOuNull(valor) {
  return texto(valor) || null;
}

// Junta o registro atual com o que veio na requisição.
// Campos que não vieram (undefined) mantêm o valor atual.
export function mesclar(atual, novos) {
  const definidos = Object.entries(novos ?? {}).filter(([, v]) => v !== undefined);
  return { ...atual, ...Object.fromEntries(definidos) };
}

// Converte id opcional para número (ou null)
export function idOuNull(valor) {
  if (valor === undefined || valor === null || valor === "") return null;
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : NaN;
}
