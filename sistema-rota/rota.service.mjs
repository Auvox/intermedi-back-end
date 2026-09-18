const VALHALLA_URL = (
  process.env.VALHALLA_URL ||
  "https://valhalla1.openstreetmap.de"
).replace(/\/+$/, "");

export async function calcularRota(origem, destino, modo = "pedestrian") {
  const consulta = {
    locations: [
      { lat: origem.latitude, lon: origem.longitude },
      { lat: destino.latitude, lon: destino.longitude },
    ],
    costing: modo,
    format: "osrm",
    shape_format: "geojson",
    language: "pt-BR",
  };

  const resposta = await fetch(`${VALHALLA_URL}/route`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Client-Id": "intermedi-dev",
    },
    body: JSON.stringify(consulta),
    signal: AbortSignal.timeout(10000),
  });

  if (!resposta.ok) {
    throw new Error("O Valhalla não conseguiu calcular a rota.");
  }

  const dados = await resposta.json();
  const rota = dados.routes?.[0];

  if (!rota || rota.geometry?.type !== "LineString") {
    throw new Error("Nenhuma rota válida foi encontrada.");
  }

  return {
    geometria: rota.geometry,
    distanciaMetros: rota.distance,
    tempoSegundos: rota.duration,
    passos: (rota.legs ?? []).flatMap((etapa) =>
      (etapa.steps ?? []).map((passo) => ({
        instrucao: passo.maneuver.instruction,
        tipo: passo.maneuver.type,
        direcao: passo.maneuver.modifier ?? null,
        rua: passo.name,
        distanciaMetros: passo.distance,
        tempoSegundos: passo.duration,
        localizacaoManobra: passo.maneuver.location,
        geometria: passo.geometry,
      })),
    ),
  };
}