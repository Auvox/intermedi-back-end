// Marcas e ícones do e-mail de boas-vindas.
// Os clientes de e-mail (Gmail, Outlook) não mostram SVG, então cada desenho
// vira PNG (sharp) na cor da plataforma e vai anexado ao e-mail; o HTML usa
// <img src="cid:nome">. No modo de teste (sem SMTP), email.service troca o
// cid: pela própria imagem em base64 para o .html salvo abrir completo.

// Marcas minimalistas, em branco sobre a faixa colorida do topo
const MARCAS = {
  // cruz vazada da Intermedi
  intermedi: () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none">
    <path d="M17 5h14v12h12v14H31v12H17V31H5V17h12z" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>
  </svg>`,
  // o "A" da Auvox: um triângulo grande e um pequeno ao lado
  auvox: () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
    <path d="M27 5 44 41 19 32z" fill="#fff"/>
    <path d="M13 26 21 38 5 41z" fill="#fff" fill-opacity=".7"/>
  </svg>`,
};

// Ícones de traço (24×24), pintados com a cor da plataforma
const TRACOS = {
  boasVindas: '<path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8z"/><path d="M18.5 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  funcao: '<rect x="4" y="3" width="16" height="18" rx="3"/><circle cx="12" cy="10" r="2.6"/><path d="M8 17.5c.8-2 2.3-3 4-3s3.2 1 4 3"/>',
  unidade: '<path d="M4 10v10h16V10M3 10l2-6h14l2 6M3 10c0 3 4.5 3 4.5 0 0 3 4.5 3 4.5 0 0 3 4.5 3 4.5 0 0 3 4.5 3 4.5 0M9 20v-6h6v6"/>',
  pessoa: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c1.2-3.5 3.8-5 7-5s5.8 1.5 7 5"/>',
  chave: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2 2M14 9l2 2"/>',
  chamado: '<path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z"/><path d="M14 7v10" stroke-dasharray="2 2"/>',
  estoque: '<path d="m12 3 9 5-9 5-9-5 9-5ZM3 8v10l9 5 9-5V8M12 13v10"/>',
  caminhao: '<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
  paciente: '<path d="M12 20s-7-4.4-7-9.6A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.4C19 15.6 12 20 12 20z"/>',
  equipe: '<circle cx="9" cy="8" r="3"/><path d="M3 19c.9-3 3.2-4.5 6-4.5s5.1 1.5 6 4.5"/><circle cx="17" cy="9" r="2.4"/><path d="M17 14.6c2 .2 3.4 1.6 4 4"/>',
  rede: '<circle cx="12" cy="5" r="2.2"/><circle cx="5" cy="18" r="2.2"/><circle cx="19" cy="18" r="2.2"/><path d="M11 7 6 16M13 7l5 9M7.2 18h9.6"/>',
};

const icone = (nome, cor) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${cor}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${TRACOS[nome]}</svg>`;

// tamanho de exibição no e-mail (px); o PNG sai com o dobro para telas retina
export const TAMANHOS = { marca: 26, icone: 22 };

const cache = new Map();

async function desenhar(svg, tamanho) {
  const { default: sharp } = await import("sharp");
  return sharp(Buffer.from(svg), { density: 384 }).resize(tamanho * 2, tamanho * 2).png().toBuffer();
}

// nomes: os que o HTML usa (ex.: ["marca-intermedi", "icone-funcao"])
export async function imagensDoEmail(nomes, cor) {
  const anexos = [];
  for (const nome of new Set(nomes)) {
    const [tipo, chave] = nome.split(/-(.+)/);
    const svg = tipo === "marca" ? MARCAS[chave]?.() : TRACOS[chave] && icone(chave, cor);
    if (!svg) continue;
    const id = `${nome}:${cor}`;
    if (!cache.has(id)) cache.set(id, await desenhar(svg, TAMANHOS[tipo]));
    anexos.push({ cid: nome, filename: `${nome}.png`, content: cache.get(id), contentType: "image/png" });
  }
  return anexos;
}
