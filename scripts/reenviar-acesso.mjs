// Gera uma senha provisória nova e manda de novo o e-mail de boas-vindas com a
// matrícula. Útil quando o cadastro foi feito antes de configurar o SMTP ou
// quando a pessoa perdeu o e-mail. A senha antiga deixa de valer e as sessões
// abertas dessa pessoa caem.
//
//   npm run acesso:reenviar -- --matricula G200980
//
// Sem SMTP no .env, o e-mail fica salvo em tmp/emails (o caminho aparece abaixo).
import { parseArgs } from "node:util";
import db from "../database/database.mjs";
import { enviarBoasVindas } from "../services/email.service.mjs";
import { gerarHashSenha, gerarSenhaProvisoria } from "../utils/senha.mjs";

const PESSOAS = [
  { papel: "admin", sql: "SELECT id_admin AS id, nome, email, cpf, matricula, NULL AS idFarmacia FROM admin", colunaId: "id_admin" },
  { papel: "gerente", sql: "SELECT id_gerente AS id, nome, email, cpf, matricula, id_farmacia AS idFarmacia FROM gerente", colunaId: "id_gerente" },
  { papel: "funcionario", sql: "SELECT id_funcionario AS id, nome, email, cpf, matricula, id_farmacia AS idFarmacia FROM funcionario", colunaId: "id_funcionario" },
];

const { values } = parseArgs({ options: { matricula: { type: "string" } } });
const matricula = String(values.matricula ?? "").trim().toUpperCase();
if (!matricula) {
  console.error("Informe a matrícula: npm run acesso:reenviar -- --matricula G000123");
  process.exit(1);
}

const achados = PESSOAS.flatMap((p) =>
  db.prepare(`${p.sql} WHERE upper(matricula) = ?`).all(matricula).map((pessoa) => ({ ...pessoa, ...p })));
if (achados.length !== 1) {
  console.error(achados.length ? `Mais de uma pessoa com a matrícula ${matricula}.` : `Nenhuma pessoa com a matrícula ${matricula}.`);
  process.exit(1);
}
const [pessoa] = achados;
const tabela = pessoa.papel;

const senhaProvisoria = gerarSenhaProvisoria();
const { changes } = db.prepare(`UPDATE ${tabela} SET senha_hash = ? WHERE ${pessoa.colunaId} = ?`)
  .run(gerarHashSenha(senhaProvisoria), pessoa.id);
// sem a senha gravada, o e-mail mandaria uma senha que não funciona
if (Number(changes) !== 1) {
  console.error("Não foi possível gravar a senha nova. Nenhum e-mail foi enviado.");
  process.exit(1);
}

const envio = await enviarBoasVindas({
  papel: pessoa.papel, nome: pessoa.nome, email: pessoa.email, cpf: pessoa.cpf,
  matricula: pessoa.matricula, senhaProvisoria, idFarmacia: pessoa.idFarmacia,
});

console.log(`${pessoa.nome} (${pessoa.papel}, matrícula ${pessoa.matricula}) <${pessoa.email}>`);
if (envio.status === "enviado") console.log(`E-mail enviado com a senha provisória nova.`);
else if (envio.status === "teste") console.log("Sem SMTP no .env: o e-mail ficou salvo (caminho acima).");
else console.log(`O e-mail não foi enviado. Senha provisória (entregue pessoalmente): ${senhaProvisoria}`);
