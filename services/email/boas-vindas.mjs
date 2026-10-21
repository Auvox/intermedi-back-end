import { paletaDoPapel } from "./paleta.mjs";
import { TAMANHOS } from "./imagens.mjs";

// E-mail de boas-vindas para quem acabou de entrar na equipe (admin, gerente
// ou funcionário): primeiro o "seja bem-vindo(a)", o que a pessoa vai fazer e
// só depois os dados de acesso. A cor é a da plataforma de quem foi
// cadastrado. HTML com tabelas e estilos inline: é o que os clientes de
// e-mail (Gmail, Outlook...) entendem. As imagens vêm de imagens.mjs (cid:).

const NOMES_PAPEL = { admin: "Administrador(a)", gerente: "Gerente", funcionario: "Funcionário(a)" };

// o que cada perfil faz no Intermedi: [ícone, título, descrição]
const ATIVIDADES = {
  admin: [
    ["rede", "Acompanhar a rede", "Veja todas as farmácias, chamados e pedidos em um só painel."],
    ["equipe", "Montar as equipes", "Cadastre os gerentes de cada unidade."],
    ["estoque", "Cuidar do catálogo", "Mantenha os remédios da rede sempre atualizados."],
  ],
  gerente: [
    ["chamado", "Responder a equipe", "Aceite os pedidos de reposição dos seus funcionários."],
    ["estoque", "Acompanhar o estoque", "Saiba o que está acabando ou perto de vencer."],
    ["caminhao", "Contar com a rede", "Busque o remédio que falta em outras farmácias."],
  ],
  funcionario: [
    ["paciente", "Atender os pacientes", "Registre os atendimentos e a retirada de remédios."],
    ["chamado", "Pedir reposição", "Avise o gerente quando um remédio estiver acabando."],
    ["caminhao", "Preparar pedidos", "Separe os remédios que outras farmácias pediram."],
  ],
};

const FONTE = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Inter,Roboto,'Helvetica Neue',Arial,sans-serif";

const escapar = (valor) => String(valor ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

// "111.111.111-11" -> "***.***.***-11"
export function mascararCpf(cpf) {
  const digitos = String(cpf ?? "").replace(/\D/g, "");
  return digitos.length === 11 ? `***.***.***-${digitos.slice(9)}` : "";
}

const primeiroNome = (nome) => String(nome ?? "").trim().split(/\s+/)[0] || "";

export function montarBoasVindas({ nome, papel, matricula, cpf, senhaProvisoria, nomeFarmacia, cadastradoPor, urlLogin }) {
  const c = paletaDoPapel(papel);
  const papelTexto = NOMES_PAPEL[papel] ?? papel;
  const atividades = ATIVIDADES[papel] ?? ATIVIDADES.funcionario;
  const cpfMascarado = mascararCpf(cpf);
  const assunto = `Bem-vindo(a) à equipe Intermedi x Auvox, ${primeiroNome(nome)}!`;
  const imagens = new Set(["marca-intermedi", "marca-auvox", "icone-boasVindas", "icone-chave"]);

  const img = (nome, tamanho, alt = "") => {
    imagens.add(nome);
    return `<img src="cid:${nome}" width="${tamanho}" height="${tamanho}" alt="${escapar(alt)}" style="display:block;border:0;width:${tamanho}px;height:${tamanho}px;">`;
  };
  // ícone dentro de um quadrado suave na cor da plataforma
  const selo = (nomeIcone, tamanhoCaixa = 40) => `
    <td width="${tamanhoCaixa}" valign="top" style="width:${tamanhoCaixa}px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td align="center" valign="middle" width="${tamanhoCaixa}" height="${tamanhoCaixa}" style="width:${tamanhoCaixa}px;height:${tamanhoCaixa}px;background:${c.suave};border-radius:12px;">${img(`icone-${nomeIcone}`, TAMANHOS.icone)}</td>
      </tr></table>
    </td>`;

  // Função / Unidade / Cadastrado por
  const detalhes = [
    ["funcao", "Função", papelTexto],
    ...(nomeFarmacia ? [["unidade", "Unidade", nomeFarmacia]] : []),
    ...(cadastradoPor ? [["pessoa", "Quem te cadastrou", cadastradoPor]] : []),
  ].map(([icone, rotulo, valor]) => `
          <tr>
            ${selo(icone)}
            <td style="padding:0 0 14px 14px;font-family:${FONTE};">
              <div style="font-size:12px;line-height:1.4;color:${c.textoSuave};">${escapar(rotulo)}</div>
              <div style="font-size:16px;line-height:1.4;font-weight:600;color:${c.texto};">${escapar(valor)}</div>
            </td>
          </tr>`).join("");

  const passos = atividades.map(([icone, titulo, descricao]) => `
          <tr>
            ${selo(icone)}
            <td style="padding:0 0 18px 14px;font-family:${FONTE};">
              <div style="font-size:15px;line-height:1.4;font-weight:600;color:${c.texto};">${escapar(titulo)}</div>
              <div style="font-size:14px;line-height:1.5;color:${c.textoSuave};">${escapar(descricao)}</div>
            </td>
          </tr>`).join("");

  // dados de acesso: discretos, no fim. data-campo ajuda os testes a lerem.
  const acesso = [
    ["matricula", "Matrícula", matricula],
    ...(cpfMascarado ? [["cpf", "CPF", cpfMascarado]] : []),
    ...(senhaProvisoria ? [["senha", "Senha provisória", senhaProvisoria]] : []),
  ].map(([campo, rotulo, valor]) => `
                <tr>
                  <td style="padding:6px 0;font-family:${FONTE};font-size:13px;color:${c.textoSuave};">${escapar(rotulo)}</td>
                  <td align="right" data-campo="${campo}" style="padding:6px 0;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:14px;font-weight:600;color:${c.texto};letter-spacing:.04em;">${escapar(valor)}</td>
                </tr>`).join("");

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapar(assunto)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${c.fundo};">
  <div style="display:none;max-height:0;overflow:hidden;">Que bom ter você com a gente. Veja como começar no Intermedi.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.fundo};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${c.cartao};border-radius:24px;overflow:hidden;">
          <tr>
            <td style="background:${c.primaria};padding:22px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td valign="middle">${img("marca-intermedi", TAMANHOS.marca, "Intermedi")}</td>
                <td valign="middle" style="padding:0 0 0 10px;font-family:${FONTE};font-size:17px;font-weight:600;color:${c.textoSobrePrimaria};letter-spacing:-.01em;">Intermedi</td>
                <td valign="middle" style="padding:0 14px;font-family:${FONTE};font-size:15px;color:${c.textoSobrePrimaria};opacity:.6;">&times;</td>
                <td valign="middle">${img("marca-auvox", TAMANHOS.marca, "Auvox")}</td>
                <td valign="middle" style="padding:0 0 0 10px;font-family:${FONTE};font-size:17px;font-weight:600;color:${c.textoSobrePrimaria};letter-spacing:.08em;">AUVOX</td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 32px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td align="center" valign="middle" width="56" height="56" style="width:56px;height:56px;background:${c.suave};border-radius:16px;">${img("icone-boasVindas", 28)}</td>
              </tr></table>
              <h1 style="margin:24px 0 12px;font-family:${FONTE};font-size:30px;line-height:1.15;font-weight:700;letter-spacing:-.02em;color:${c.texto};">Bem-vindo(a) à equipe, ${escapar(primeiroNome(nome))}!</h1>
              <p style="margin:0;font-family:${FONTE};font-size:17px;line-height:1.5;color:${c.textoSuave};">É muito bom ter você com a gente. A partir de hoje você faz parte do <strong style="color:${c.texto};font-weight:600;">Intermedi</strong>, a rede da <strong style="color:${c.texto};font-weight:600;">Auvox</strong> que conecta farmácias para que nenhum paciente fique sem o remédio de que precisa.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 10px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${detalhes}
              </table>
            </td>
          </tr>
          <tr><td style="padding:0 32px;"><div style="height:1px;background:${c.divisoria};"></div></td></tr>
          <tr>
            <td style="padding:28px 32px 6px;">
              <p style="margin:0 0 18px;font-family:${FONTE};font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:${c.tinta};">No dia a dia você vai</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${passos}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:6px 32px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.caixa};border-radius:16px;">
                <tr>
                  <td style="padding:20px 22px 14px;">
                    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                      <td valign="middle">${img("icone-chave", 18)}</td>
                      <td valign="middle" style="padding-left:8px;font-family:${FONTE};font-size:15px;font-weight:600;color:${c.texto};">Seu primeiro acesso</td>
                    </tr></table>
                    <p style="margin:6px 0 10px;font-family:${FONTE};font-size:13px;line-height:1.5;color:${c.textoSuave};">Entre com seu CPF, a matrícula e a senha${senhaProvisoria ? " provisória" : " combinada no cadastro"}.</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${acesso}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${urlLogin ? `<tr>
            <td style="padding:24px 32px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td style="background:${c.primaria};border-radius:980px;">
                  <a href="${escapar(urlLogin)}" style="display:inline-block;padding:14px 30px;font-family:${FONTE};font-size:16px;font-weight:600;color:${c.textoSobrePrimaria};text-decoration:none;border-radius:980px;">Entrar no Intermedi</a>
                </td>
              </tr></table>
            </td>
          </tr>` : ""}
          <tr>
            <td style="padding:24px 32px 36px;font-family:${FONTE};font-size:13px;line-height:1.5;color:${c.textoFraco};">
              Não compartilhe sua senha com ninguém. Se você não reconhece este cadastro, pode ignorar este e-mail.
            </td>
          </tr>
        </table>
        <p style="margin:20px 0 0;font-family:${FONTE};font-size:12px;line-height:1.5;color:${c.textoFraco};">Intermedi &times; Auvox &middot; Onde a inovação tem valor de ouro<br>Mensagem automática, não responda.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const texto = [
    `Bem-vindo(a) à equipe, ${primeiroNome(nome)}!`,
    "",
    "É muito bom ter você com a gente. A partir de hoje você faz parte do Intermedi, a rede da Auvox que conecta farmácias para que nenhum paciente fique sem o remédio de que precisa.",
    "",
    `Função: ${papelTexto}`,
    ...(nomeFarmacia ? [`Unidade: ${nomeFarmacia}`] : []),
    ...(cadastradoPor ? [`Quem te cadastrou: ${cadastradoPor}`] : []),
    "",
    "No dia a dia você vai:",
    ...atividades.map(([, titulo, descricao]) => `- ${titulo}: ${descricao}`),
    "",
    "Seu primeiro acesso",
    `Matrícula: ${matricula}`,
    ...(cpfMascarado ? [`CPF: ${cpfMascarado}`] : []),
    ...(senhaProvisoria ? [`Senha provisória: ${senhaProvisoria}`] : []),
    `Entre com seu CPF, a matrícula e a senha${senhaProvisoria ? " provisória" : " combinada no cadastro"}.`,
    ...(urlLogin ? [`Entrar: ${urlLogin}`] : []),
    "",
    "Não compartilhe sua senha com ninguém. Se você não reconhece este cadastro, pode ignorar este e-mail.",
    "Intermedi x Auvox",
  ].join("\n");

  return { assunto, html, texto, imagens: [...imagens], cor: c.primaria };
}
