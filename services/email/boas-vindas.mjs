import { PALETA } from "./paleta.mjs";

// E-mail enviado a quem acabou de ser cadastrado (gerente ou funcionário)
// com a matrícula nova. HTML com tabelas e estilos inline: é o que os
// clientes de e-mail (Gmail, Outlook...) entendem.

const NOMES_PAPEL = { admin: "administrador(a)", gerente: "gerente", funcionario: "funcionário(a)" };

const escapar = (valor) => String(valor ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

// "111.111.111-11" -> "***.***.***-11"
export function mascararCpf(cpf) {
  const digitos = String(cpf ?? "").replace(/\D/g, "");
  return digitos.length === 11 ? `***.***.***-${digitos.slice(9)}` : "";
}

export function montarBoasVindas({ nome, papel, matricula, cpf, senhaProvisoria, nomeFarmacia, cadastradoPor, urlLogin }) {
  const c = PALETA;
  const papelTexto = NOMES_PAPEL[papel] ?? papel;
  const onde = nomeFarmacia ? ` na ${nomeFarmacia}` : "";
  const assunto = `Intermedi x Auvox: sua matrícula é ${matricula}`;
  const cpfMascarado = mascararCpf(cpf);

  const linhaDado = (rotulo, valor, grande = false) => `
              <tr>
                <td style="padding:6px 0;font:600 12px/1.4 Arial,Helvetica,sans-serif;color:${c.textoSuave};text-transform:uppercase;letter-spacing:.06em;">${escapar(rotulo)}</td>
              </tr>
              <tr>
                <td style="padding:0 0 12px;font:700 ${grande ? "28px" : "16px"}/1.3 'Courier New',Courier,monospace;color:${c.texto};letter-spacing:${grande ? ".12em" : ".02em"};">${escapar(valor)}</td>
              </tr>`;

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapar(assunto)}</title>
</head>
<body style="margin:0;padding:0;background:${c.fundo};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.fundo};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${c.cartao};border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:${c.primaria};padding:28px 32px;border-bottom:4px solid ${c.destaque};">
              <div style="font:700 22px/1.2 Arial,Helvetica,sans-serif;color:${c.textoSobrePrimaria};">Intermedi <span style="font-weight:400;opacity:.8;">x</span> Auvox</div>
              <div style="font:400 13px/1.5 Arial,Helvetica,sans-serif;color:${c.textoSobrePrimaria};opacity:.85;margin-top:4px;">Seu acesso foi criado</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;font:400 15px/1.6 Arial,Helvetica,sans-serif;color:${c.texto};">
              <p style="margin:0 0 16px;font-size:18px;font-weight:700;">Olá, ${escapar(nome)}!</p>
              <p style="margin:0 0 24px;">Você foi cadastrado(a) como <strong>${escapar(papelTexto)}</strong>${escapar(onde)}${cadastradoPor ? ` por ${escapar(cadastradoPor)}` : ""}. Use os dados abaixo para entrar no Intermedi.</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.caixaMatricula};border-radius:10px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${linhaDado("Sua matrícula", matricula, true)}${cpfMascarado ? linhaDado("CPF", cpfMascarado) : ""}${senhaProvisoria ? linhaDado("Senha provisória", senhaProvisoria) : ""}
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 8px;">Para entrar, informe seu <strong>CPF</strong>, a <strong>matrícula</strong> e a <strong>senha</strong>${senhaProvisoria ? " provisória acima" : " combinada no cadastro"}.</p>
              ${urlLogin ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
                <tr>
                  <td style="background:${c.primaria};border-radius:8px;">
                    <a href="${escapar(urlLogin)}" style="display:inline-block;padding:14px 28px;font:700 15px/1 Arial,Helvetica,sans-serif;color:${c.textoSobrePrimaria};text-decoration:none;">Entrar no Intermedi</a>
                  </td>
                </tr>
              </table>` : ""}
              <p style="margin:24px 0 0;font-size:13px;color:${c.textoSuave};">Não compartilhe sua senha com ninguém. Se você não reconhece este cadastro, ignore este e-mail.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid ${c.caixaMatricula};font:400 12px/1.5 Arial,Helvetica,sans-serif;color:${c.textoSuave};">
              Intermedi x Auvox &middot; mensagem automática, não responda.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const texto = [
    `Olá, ${nome}!`,
    "",
    `Você foi cadastrado(a) como ${papelTexto}${onde}${cadastradoPor ? ` por ${cadastradoPor}` : ""}.`,
    "",
    `Sua matrícula: ${matricula}`,
    ...(cpfMascarado ? [`CPF: ${cpfMascarado}`] : []),
    ...(senhaProvisoria ? [`Senha provisória: ${senhaProvisoria}`] : []),
    "",
    `Para entrar, informe seu CPF, a matrícula e a senha${senhaProvisoria ? " provisória" : " combinada no cadastro"}.`,
    ...(urlLogin ? [`Entrar: ${urlLogin}`] : []),
    "",
    "Não compartilhe sua senha com ninguém. Se você não reconhece este cadastro, ignore este e-mail.",
    "Intermedi x Auvox",
  ].join("\n");

  return { assunto, html, texto };
}
