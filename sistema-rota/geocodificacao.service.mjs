import { erro } from "../utils/http.mjs";


export async function geocodificarEndereco(endereco) {
  const campos = ["logradouro", "numero", "bairro", "cidade", "uf", "cep"];
  if (!endereco || campos.some((campo) => !String(endereco[campo] ?? "").trim())) {
    throw erro(400, "Informe o endereço completo para obter as coordenadas.");
  }

  const chave = process.env.GEOAPIFY_API_KEY?.trim();
  if (!chave) throw erro(503, "Configure GEOAPIFY_API_KEY no .env do back-end.");

  const url = new URL("https://api.geoapify.com/v1/geocode/search");
  url.search = new URLSearchParams({
    text: [...campos.map((campo) => String(endereco[campo]).trim()), "Brasil"].join(", "),
    format: "json",
    filter: "countrycode:br",
    lang: "pt",
    limit: "1",
    apiKey: chave,
  }).toString();

  let resposta;
  try {
    resposta = await fetch(url, { signal: AbortSignal.timeout(10000) });
  } catch {
    throw erro(503, "Não foi possível consultar o serviço de geocodificação. Tente novamente.");
  }
  if (!resposta.ok) {
    throw erro(503, "O serviço de geocodificação não conseguiu atender à consulta.");
  }

  let dados;
  try {
    dados = await resposta.json();
  } catch {
    throw erro(502, "O serviço de geocodificação retornou uma resposta inválida.");
  }
  if (!Array.isArray(dados?.results)) {
    throw erro(502, "O serviço de geocodificação retornou uma resposta inválida.");
  }
  const resultado = dados.results[0];
  if (!resultado) return null;

  const { lat: latitude, lon: longitude } = resultado;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw erro(502, "O serviço de geocodificação retornou coordenadas inválidas.");
  }
  
  if (!resultado.housenumber ||
      String(resultado.housenumber).trim().toLowerCase() !== String(endereco.numero).trim().toLowerCase()) {
    return null;
  }
  return { latitude, longitude };
}
