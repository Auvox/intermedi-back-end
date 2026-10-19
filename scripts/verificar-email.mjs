import "../utils/ambiente.mjs";
import nodemailer from "nodemailer";

if (!process.env.SMTP_HOST) {
  console.error("SMTP_HOST não configurado. Os e-mails serão salvos em arquivo, sem envio.");
  process.exitCode = 1;
} else {
  const porta = Number(process.env.SMTP_PORT || 587);
  const transporte = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: porta,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : porta === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  try {
    await transporte.verify();
    console.log("SMTP conectado e autenticado. Nenhum e-mail foi enviado.");
  } catch (error) {
    console.error(`Falha no SMTP (${error.code || "erro"}): ${error.message}`);
    process.exitCode = 1;
  } finally {
    transporte.close();
  }
}
