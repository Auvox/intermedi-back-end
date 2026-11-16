import { paletaDoPapel } from "./paleta.mjs";
import { MARCAS } from "./imagens.mjs";

// E-mail de boas-vindas para quem acabou de entrar na equipe (admin, gerente
// ou funcionário). É escrito como uma carta, na fonte do sistema (SF, Segoe,
// Inter): as logos reais da Intermedi e da Auvox no topo, o "boas-vindas" em
// letra grande e os dados de acesso num crachá, na cor da plataforma de quem
// foi cadastrado. HTML com tabelas e
// estilos inline: é o que os clientes de e-mail (Gmail, Outlook...) entendem.
// As logos vêm de imagens.mjs (cid:).

const NOMES_PAPEL = { admin: "Administração", gerente: "Gerente", funcionario: "Funcionário(a)" };

// o que cada perfil faz no Intermedi: [título, descrição]
const ATIVIDADES = {
  admin: [
    ["Acompanhar a rede", "Veja farmácias, pedidos e entregas de toda a rede em um só lugar."],
    ["Montar as equipes", "Cadastre os gerentes de cada unidade."],
    ["Cuidar do catálogo", "Mantenha a lista de remédios da rede sempre atualizada."],
  ],
  gerente: [
    ["Responder a sua equipe", "Quando um funcionário pedir reposição, você aceita o pedido e acompanha até o remédio chegar."],
    ["Ficar de olho no estoque", "Veja o que está acabando ou perto de vencer antes que falte no balcão."],
    ["Contar com a rede", "Se faltar um remédio, o Intermedi procura nas outras farmácias e mostra o caminho da entrega."],
  ],
  funcionario: [
    ["Atender os pacientes", "Registre cada atendimento e a retirada dos remédios."],
    ["Pedir reposição", "Viu que um remédio está acabando? Peça ao seu gerente em poucos toques."],
    ["Preparar os pedidos", "Separe os remédios que outras farmácias da rede pediram à sua."],
  ],
};

const FONTE = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Inter,Roboto,'Helvetica Neue',Arial,sans-serif";
const MONO = "'SF Mono',Menlo,Consolas,'Courier New',monospace";

const escapar = (valor) => String(valor ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

// "111.111.111-11" -> "***.***.***-11"
export function mascararCpf(cpf) {
  const digitos = String(cpf ?? "").replace(/\D/g, "");
  return digitos.length === 11 ? `***.***.***-${digitos.slice(9)}` : "";
}

const palavras = (nome) => String(nome ?? "").trim().split(/\s+/).filter(Boolean);
const primeiroNome = (nome) => palavras(nome)[0] || "";
// "Ana Beatriz Souza" -> "AS"
function iniciais(nome) {
  const p = palavras(nome);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p.at(-1)[0] : "")).toUpperCase();
}

// a frase que diz onde a pessoa entra
function lugarNaEquipe(papel, nomeFarmacia) {
  if (papel === "admin") return "você cuida da rede inteira";
  if (papel === "gerente") return nomeFarmacia ? `você é gerente da ${nomeFarmacia}` : "você é gerente de uma das farmácias da rede";
  return nomeFarmacia ? `você faz parte da equipe da ${nomeFarmacia}` : "você faz parte da equipe de uma das farmácias da rede";
}

export function montarBoasVindas({ nome, papel, matricula, cpf, senhaProvisoria, nomeFarmacia, cadastradoPor, urlLogin, desde = new Date() }) {
  const c = paletaDoPapel(papel);
  const papelTexto = NOMES_PAPEL[papel] ?? papel;
  const atividades = ATIVIDADES[papel] ?? ATIVIDADES.funcionario;
  const cpfMascarado = mascararCpf(cpf);
  const nome1 = primeiroNome(nome);
  // gerente e funcionário entram com CPF + matrícula; o admin, com CPF + senha
  const comSenha = papel === "admin";
  const senha = comSenha ? senhaProvisoria : null;
  const comoEntrar = comSenha
    ? `Para entrar, use seu CPF e a senha${senha ? " provisória do crachá" : " combinada no cadastro"}.`
    : "Para entrar, use seu CPF e a matrícula do crachá. Não precisa de senha.";
  const data = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" }).format(desde);
  const funcaoCompleta = [papelTexto, papel === "admin" ? null : nomeFarmacia].filter(Boolean).join(" · ");
  const assunto = `Boas-vindas à equipe Intermedi, ${nome1}`;
  const imagens = Object.keys(MARCAS);

  const logo = (id, alt) => {
    const { largura, altura } = MARCAS[id];
    return `<img src="cid:${id}" class="logo-${id.slice(6)}" width="${largura}" height="${altura}" alt="${alt}" style="display:block;border:0;outline:none;width:${largura}px;height:${altura}px;">`;
  };

  // dados do crachá. data-campo ajuda os testes a lerem.
  const dado = (campo, rotulo, valor, tamanho) => `
                  <td valign="top" class="cracha-dado" style="padding:16px 18px;">
                    <div style="font-family:${FONTE};font-size:14px;line-height:1.4;color:${c.textoSuave};">${rotulo}</div>
                    <div data-campo="${campo}" style="margin-top:4px;font-family:${MONO};font-size:${tamanho}px;line-height:1.2;font-weight:700;color:${c.texto};letter-spacing:.02em;">${escapar(valor)}</div>
                  </td>`;
  const dados = [
    ...(matricula ? [["matricula", "Matrícula", matricula, 26]] : []),
    ...(cpfMascarado ? [["cpf", "CPF", cpfMascarado, 19]] : []),
    ...(senha ? [["senha", "Senha provisória", senha, 19]] : []),
  ];
  // duas colunas por linha
  const linhasDados = [];
  for (let i = 0; i < dados.length; i += 2) {
    const par = dados.slice(i, i + 2);
    linhasDados.push(`
                <tr>${par.map((d) => dado(...d)).join("")}${par.length === 1 ? "<td></td>" : ""}
                </tr>`);
  }

  const passos = atividades.map(([titulo, descricao], i) => `
            <tr>
              <td width="40" valign="top" style="width:40px;padding:0 0 22px;font-family:${FONTE};font-size:24px;line-height:1.1;font-weight:700;color:${c.primaria};">${i + 1}</td>
              <td valign="top" style="padding:2px 0 22px;">
                <div style="font-family:${FONTE};font-size:18px;line-height:1.4;font-weight:700;color:${c.texto};">${escapar(titulo)}</div>
                <div style="margin-top:4px;font-family:${FONTE};font-size:17px;line-height:1.55;color:${c.textoSuave};">${escapar(descricao)}</div>
              </td>
            </tr>`).join("");

  const assinatura = cadastradoPor
    ? `<strong style="font-weight:700;color:${c.texto};">${escapar(cadastradoPor)}</strong><br><span style="color:${c.textoSuave};">e toda a equipe Intermedi</span>`
    : `<strong style="font-weight:700;color:${c.texto};">Equipe Intermedi</strong>`;

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapar(assunto)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  @media (max-width: 620px) {
    .carta { border-radius: 0 !important; }
    .miolo { padding-left: 24px !important; padding-right: 24px !important; }
    .titulo { font-size: 34px !important; }
    .cracha-dado { display: block !important; width: auto !important; }
    .logo-intermedi { width: 132px !important; height: 83px !important; }
    .logo-auvox { width: 124px !important; height: 33px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${c.fundo};">
  <div style="display:none;max-height:0;overflow:hidden;">Seu crachá e o seu primeiro acesso ao Intermedi estão aqui.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.fundo};">
    <tr>
      <td align="center" style="padding:32px 0;">
        <table role="presentation" class="carta" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${c.cartao};border-radius:20px;">
          <tr>
            <td class="miolo" style="padding:36px 48px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td valign="middle">${logo("marca-intermedi", "Intermedi")}</td>
                <td valign="middle" align="right">${logo("marca-auvox", "Auvox")}</td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td class="miolo" style="padding:28px 48px 0;">
              <h1 class="titulo" style="margin:0 0 22px;font-family:${FONTE};font-size:40px;line-height:1.1;font-weight:700;letter-spacing:-.02em;color:${c.texto};">Boas-vindas à equipe, ${escapar(nome1)}.</h1>
              <p style="margin:0 0 16px;font-family:${FONTE};font-size:19px;line-height:1.6;color:${c.texto};">Que bom ter você com a gente. A partir de hoje ${escapar(lugarNaEquipe(papel, nomeFarmacia))} no Intermedi, o sistema da Auvox que liga as farmácias da rede para que nenhum paciente fique sem o remédio de que precisa.</p>
              <p style="margin:0;font-family:${FONTE};font-size:19px;line-height:1.6;color:${c.texto};">Seu crachá está logo abaixo. Guarde este e-mail: é com ele que você entra pela primeira vez.</p>
            </td>
          </tr>
          <tr>
            <td class="miolo" style="padding:32px 48px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${c.borda};border-radius:18px;border-collapse:separate;">
                <tr>
                  <td style="background:${c.primaria};border-radius:17px 17px 0 0;padding:12px 22px 14px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                      <tr><td align="center" style="padding-bottom:10px;"><div style="width:52px;height:8px;border-radius:4px;background:${c.cartao};opacity:.55;font-size:0;line-height:0;">&nbsp;</div></td></tr>
                      <tr><td>
                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                          <td style="font-family:${FONTE};font-size:15px;font-weight:700;color:${c.textoSobrePrimaria};">Equipe Intermedi</td>
                          <td align="right" style="font-family:${FONTE};font-size:14px;color:${c.textoSobrePrimaria};">Desde ${data}</td>
                        </tr></table>
                      </td></tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px 22px 8px;">
                    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                      <td width="72" valign="middle" style="width:72px;">
                        <div style="width:72px;height:72px;border-radius:14px;background:${c.suave};font-family:${FONTE};font-size:26px;line-height:72px;font-weight:600;text-align:center;color:${c.tinta};">${escapar(iniciais(nome))}</div>
                      </td>
                      <td valign="middle" style="padding-left:18px;">
                        <div style="font-family:${FONTE};font-size:24px;line-height:1.2;font-weight:600;color:${c.texto};">${escapar(nome)}</div>
                        <div style="margin-top:6px;font-family:${FONTE};font-size:16px;line-height:1.4;color:${c.textoSuave};">${escapar(funcaoCompleta)}</div>
                      </td>
                    </tr></table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 22px 22px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.caixa};border-radius:12px;">${linhasDados.join("")}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${urlLogin ? `<tr>
            <td class="miolo" style="padding:28px 48px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td style="background:${c.primaria};border-radius:12px;">
                  <a href="${escapar(urlLogin)}" style="display:inline-block;padding:17px 30px;font-family:${FONTE};font-size:18px;font-weight:700;color:${c.textoSobrePrimaria};text-decoration:none;border-radius:12px;">Entrar no Intermedi</a>
                </td>
              </tr></table>
            </td>
          </tr>` : ""}
          <tr>
            <td class="miolo" style="padding:14px 48px 0;font-family:${FONTE};font-size:16px;line-height:1.5;color:${c.textoSuave};">${escapar(comoEntrar)}</td>
          </tr>
          <tr>
            <td class="miolo" style="padding:44px 48px 0;">
              <h2 style="margin:0 0 22px;font-family:${FONTE};font-size:26px;line-height:1.2;font-weight:700;letter-spacing:-.01em;color:${c.texto};">O que você vai fazer por aqui</h2>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${passos}
              </table>
            </td>
          </tr>
          <tr>
            <td class="miolo" style="padding:14px 48px 44px;font-family:${FONTE};font-size:19px;line-height:1.6;color:${c.texto};">
              Um abraço,<br>${assinatura}
            </td>
          </tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
          <tr>
            <td class="miolo" style="padding:24px 48px 8px;font-family:${FONTE};font-size:14px;line-height:1.6;color:${c.textoFraco};">
              O Intermedi é um projeto da Auvox, onde a inovação tem valor de ouro.<br>
              Não compartilhe seus dados de acesso. Se você não reconhece este cadastro, pode ignorar este e-mail. Mensagem automática, não responda.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const texto = [
    `Boas-vindas à equipe, ${nome1}.`,
    "",
    `Que bom ter você com a gente. A partir de hoje ${lugarNaEquipe(papel, nomeFarmacia)} no Intermedi, o sistema da Auvox que liga as farmácias da rede para que nenhum paciente fique sem o remédio de que precisa.`,
    "",
    "Seu crachá",
    `${nome} · ${funcaoCompleta}`,
    ...(matricula ? [`Matrícula: ${matricula}`] : []),
    ...(cpfMascarado ? [`CPF: ${cpfMascarado}`] : []),
    ...(senha ? [`Senha provisória: ${senha}`] : []),
    "",
    comoEntrar,
    ...(urlLogin ? [`Entrar: ${urlLogin}`] : []),
    "",
    "O que você vai fazer por aqui:",
    ...atividades.map(([titulo, descricao], i) => `${i + 1}. ${titulo}: ${descricao}`),
    "",
    "Um abraço,",
    cadastradoPor ? `${cadastradoPor} e toda a equipe Intermedi` : "Equipe Intermedi",
    "",
    "O Intermedi é um projeto da Auvox. Não compartilhe seus dados de acesso. Se você não reconhece este cadastro, pode ignorar este e-mail.",
  ].join("\n");

  return { assunto, html, texto, imagens };
}
