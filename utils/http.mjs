// Erro com status HTTP (ex.: throw erro(400, "CPF inválido"))
export function erro(status, mensagem) {
  return Object.assign(new Error(mensagem), { status });
}

// Lê o corpo da requisição como JSON (objeto)
export async function lerJson(req, limiteBytes = 1024 * 1024) {
  const partes = [];
  let tamanho = 0;

  for await (const parte of req) {
    tamanho += parte.length;
    if (tamanho > limiteBytes) throw erro(413, "Dados excedem o limite permitido.");
    partes.push(parte);
  }

  try {
    const dados = JSON.parse(Buffer.concat(partes).toString("utf-8"));
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) throw new Error();
    return dados;
  } catch {
    throw erro(400, "O corpo da requisição deve ser um JSON válido.");
  }
}

export function enviarJson(res, status, dados) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(dados));
}

// Converte qualquer erro em { status, mensagem } para responder ao front
export function traduzirErro(error) {
  if (error.status) return { status: error.status, mensagem: error.message };

  const msg = String(error.message || "");
  if (error.code === "ERR_SQLITE_ERROR") {
    const coluna = msg.split(":").pop()?.trim().split(".").pop();

    if (msg.includes("UNIQUE constraint failed")) {
      return { status: 409, mensagem: `Já existe um cadastro com este valor (${coluna}).` };
    }
    if (msg.includes("FOREIGN KEY constraint failed")) {
      return {
        status: 409,
        mensagem:
          "Operação não permitida: o registro está vinculado a outro " +
          "ou aponta para um registro que não existe.",
      };
    }
    if (msg.includes("NOT NULL constraint failed")) {
      return { status: 400, mensagem: `Campo obrigatório não informado (${coluna}).` };
    }
    if (msg.includes("CHECK constraint failed")) {
      return { status: 400, mensagem: `Valor inválido (${msg.split(":").pop().trim()}).` };
    }
  }

  console.error("Erro inesperado:", error);
  return { status: 500, mensagem: "Não foi possível concluir a operação." };
}

// Responde um erro no formato que o front já usa: { error: "..." }
export function enviarErro(res, error) {
  const { status, mensagem } = traduzirErro(error);
  enviarJson(res, status, { error: mensagem });
}

// Converte o id da URL em número (404 se não for válido)
export function idDaUrl(req, rotulo = "Registro") {
  const id = Number(req.params?.id);
  if (!Number.isInteger(id) || id <= 0) throw erro(404, `${rotulo} não encontrado`);
  return id;
}
