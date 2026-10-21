import "../utils/ambiente.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import db from "../database/database.mjs";
import { montarBoasVindas } from "./email/boas-vindas.mjs";
import { imagensDoEmail } from "./email/imagens.mjs";

// Envio de e-mails.
//   • Com SMTP_HOST no .env: envia de verdade (pacote nodemailer).
//   • Sem SMTP_HOST (desenvolvimento): não envia; salva o e-mail como .html em
//     INTERMEDI_EMAIL_DIR (padrão: tmp/emails) e mostra o caminho no terminal.
// Um erro no envio nunca desfaz o cadastro: a resposta diz o que aconteceu.

const pastaPadrao = fileURLToPath(new URL("../tmp/emails/", import.meta.url));
let transporte = null;

async function transporteSmtp() {
  if (transporte) return transporte;
  let nodemailer;
  try {
    nodemailer = (await import("nodemailer")).default;
  } catch {
    throw new Error("Falta o pacote nodemailer. Rode npm install no back-end.");
  }
  const porta = Number(process.env.SMTP_PORT || 587);
  transporte = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: porta,
    // 465 = TLS direto; 587 = STARTTLS
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : porta === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return transporte;
}

const nomeDeArquivo = (texto) => String(texto).normalize("NFD").replace(/[^\w.-]+/g, "_").slice(0, 60);

// anexos: imagens usadas no HTML como <img src="cid:...">
export async function enviarEmail({ para, assunto, html, texto, anexos = [] }) {
  const remetente = process.env.EMAIL_REMETENTE || "Intermedi <nao-responda@intermedi.local>";

  if (process.env.SMTP_HOST) {
    const smtp = await transporteSmtp();
    const info = await smtp.sendMail({ from: remetente, to: para, subject: assunto, html, text: texto, attachments: anexos });
    // resposta do servidor (ex.: "250 2.0.0 OK ... gsmtp"): prova de que ele aceitou a mensagem
    console.log(`E-mail para ${para}: ${info.response} (id ${info.messageId})`);
    if (info.rejected?.length) throw new Error(`Destinatário recusado pelo servidor: ${info.rejected.join(", ")}`);
    return { status: "enviado", para, idMensagem: info.messageId };
  }

  const pasta = process.env.INTERMEDI_EMAIL_DIR || pastaPadrao;
  await mkdir(pasta, { recursive: true });
  const arquivo = `${new Date().toISOString().replace(/[:.]/g, "-")}_${nomeDeArquivo(para)}.html`;
  const cabecalho = `<!--\nDe: ${remetente}\nPara: ${para}\nAssunto: ${assunto}\n(e-mail de teste: SMTP_HOST não configurado)\n-->\n`;
  // o .html de teste abre sozinho no navegador: as imagens vão embutidas
  const comImagens = anexos.reduce(
    (pagina, { cid, content, contentType }) =>
      pagina.replaceAll(`cid:${cid}`, `data:${contentType};base64,${content.toString("base64")}`),
    html,
  );
  await writeFile(path.join(pasta, arquivo), cabecalho + comImagens, { flag: "wx" });
  console.log(`E-mail de teste (sem SMTP) para ${para}: ${path.join(pasta, arquivo)}`);
  return { status: "teste", para, arquivo };
}

// E-mail de boas-vindas com a matrícula. Nunca lança erro.
export async function enviarBoasVindas({ papel, nome, email, cpf, matricula, senhaProvisoria, idFarmacia, cadastradoPor }) {
  try {
    const nomeFarmacia = idFarmacia
      ? db.prepare("SELECT nome FROM farmacia WHERE id_farmacia = ?").get(idFarmacia)?.nome
      : null;
    const front = (process.env.INTERMEDI_FRONT_URL || "http://localhost:5173").replace(/\/$/, "");
    const { imagens, cor, ...mensagem } = montarBoasVindas({
      nome, papel, matricula, cpf, senhaProvisoria, nomeFarmacia, cadastradoPor,
      urlLogin: `${front}/login?perfil=${encodeURIComponent(papel)}`,
    });
    // sem as imagens o e-mail continua legível (os <img> têm alt)
    const anexos = await imagensDoEmail(imagens, cor).catch((error) => {
      console.warn("E-mail sem imagens:", error.message);
      return [];
    });
    return await enviarEmail({ para: email, ...mensagem, anexos });
  } catch (error) {
    console.error(`Falha ao enviar o e-mail de boas-vindas para ${email}:`, error.message);
    return { status: "falhou", para: email, erro: "Não foi possível enviar o e-mail." };
  }
}
