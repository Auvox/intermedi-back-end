import { calcularRota } from "./rota.service.mjs";

function responder(res, status, dados) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(dados));
}

function coordenadasValidas(ponto) {
  return (
    ponto &&
    Number.isFinite(ponto.latitude) &&
    Number.isFinite(ponto.longitude) &&
    ponto.latitude >= -90 &&
    ponto.latitude <= 90 &&
    ponto.longitude >= -180 &&
    ponto.longitude <= 180
  );
}

export async function consultarRota(req, res) {
  let dados;

  try {
    const partes = [];
    let tamanho = 0;

    for await (const parte of req) {
      tamanho += parte.length;

      if (tamanho > 8192) {
        responder(res, 413, { message: "Pedido muito grande." });
        return;
      }

      partes.push(parte);
    }

    dados = JSON.parse(Buffer.concat(partes).toString("utf8"));
  } catch {
    responder(res, 400, { message: "Envie um JSON válido." });
    return;
  }

  const { origem, destino, modo = "pedestrian" } = dados ?? {};

  if (!coordenadasValidas(origem) || !coordenadasValidas(destino)) {
    responder(res, 400, {
      message: "Origem e destino precisam ter coordenadas válidas.",
    });
    return;
  }

  const modosPermitidos = [
    "pedestrian",
    "auto",
    "motorcycle",
    "bicycle",
  ];

  if (!modosPermitidos.includes(modo)) {
    responder(res, 400, {
      message:
        "Modo permitido: pedestrian, auto, motorcycle ou bicycle.",
    });
    return;
  }

  try {
    const rota = await calcularRota(origem, destino, modo);
    responder(res, 200, rota);
  } catch (erro) {
    const demorou = erro.name === "TimeoutError";

    responder(res, demorou ? 504 : 502, {
      message: demorou
        ? "O cálculo da rota demorou demais. Tente novamente."
        : "Não foi possível obter a rota. Tente novamente.",
    });
  }
}