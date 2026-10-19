// Cria um admin (ou completa um admin antigo) com CPF, matrícula e senha provisória,
// e manda o e-mail de boas-vindas. É assim que entra o primeiro admin: ninguém
// pode cadastrá-lo pela tela.
//
//   npm run admin:criar -- --nome "Maria Silva" --email maria@exemplo.com --cpf 123.456.789-09
//   npm run admin:criar -- --id 1 --cpf 123.456.789-09      (admin que já existe)
//
// Sem SMTP no .env, o e-mail fica salvo em tmp/emails (o caminho aparece abaixo).
import { parseArgs } from "node:util";
import db, { emTransacao } from "../database/database.mjs";
import { enviarBoasVindas } from "../services/email.service.mjs";
import { gerarMatriculaUnica } from "../services/matricula.service.mjs";
import { gerarHashSenha, gerarSenhaProvisoria } from "../utils/senha.mjs";

const { values } = parseArgs({
  options: { id: { type: "string" }, nome: { type: "string" }, email: { type: "string" }, cpf: { type: "string" } },
});

function parar(mensagem) {
  console.error(mensagem);
  process.exit(1);
}

const cpf = String(values.cpf ?? "").trim();
if (cpf.replace(/\D/g, "").length !== 11) parar("Informe --cpf com 11 dígitos.");

const senhaProvisoria = gerarSenhaProvisoria();
const admin = emTransacao(() => {
  const matricula = gerarMatriculaUnica("admin", "A");
  if (values.id) {
    const atual = db.prepare("SELECT id_admin, nome, email FROM admin WHERE id_admin = ?").get(Number(values.id));
    if (!atual) parar(`Admin ${values.id} não encontrado.`);
    db.prepare("UPDATE admin SET cpf = ?, matricula = ?, senha_hash = ? WHERE id_admin = ?")
      .run(cpf, matricula, gerarHashSenha(senhaProvisoria), atual.id_admin);
    return { id: atual.id_admin, nome: atual.nome, email: atual.email, matricula };
  }
  const nome = String(values.nome ?? "").trim();
  const email = String(values.email ?? "").trim();
  if (!nome || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) parar("Informe --nome e um --email válido.");
  const { lastInsertRowid } = db.prepare(
    "INSERT INTO admin (nome, email, senha_hash, cpf, matricula) VALUES (?, ?, ?, ?, ?)",
  ).run(nome, email, gerarHashSenha(senhaProvisoria), cpf, matricula);
  return { id: Number(lastInsertRowid), nome, email, matricula };
});

const envio = await enviarBoasVindas({
  papel: "admin", nome: admin.nome, email: admin.email, cpf, matricula: admin.matricula, senhaProvisoria,
});

console.log(`Admin #${admin.id}: ${admin.nome} <${admin.email}>`);
console.log(`Matrícula: ${admin.matricula}`);
if (envio.status === "falhou") {
  console.log(`O e-mail não foi enviado. Senha provisória (entregue pessoalmente): ${senhaProvisoria}`);
} else {
  console.log(envio.status === "teste"
    ? "Senha provisória no e-mail de teste (caminho acima)."
    : `Senha provisória enviada para ${admin.email}.`);
}
