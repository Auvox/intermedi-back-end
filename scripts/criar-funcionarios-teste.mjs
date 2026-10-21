// Cadastra funcionários de teste (2 por farmácia) pela API, como o gerente faz
// na tela de Funcionários. Pode rodar mais de uma vez: quem já existe é mantido.
// Uso, com o servidor ligado:  npm run funcionarios:teste
// Os e-mails terminam em @teste.intermedi.com, para ficar claro que são de teste.
const API_URL = (process.env.INTERMEDI_API_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, "");

// CPF fictício com dígitos verificadores válidos, a partir de 9 dígitos
function cpf(base) {
  const d = base.split("").map(Number);
  for (const tamanho of [9, 10]) {
    const soma = d.slice(0, tamanho).reduce((total, n, i) => total + n * (tamanho + 1 - i), 0);
    const resto = (soma * 10) % 11;
    d.push(resto === 10 ? 0 : resto);
  }
  const s = d.join("");
  return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}-${s.slice(9)}`;
}

// [farmácia, nome, usuário do e-mail, cargo, turno, base do CPF]
const FUNCIONARIOS = [
  [1, "Camila Duarte", "camila.duarte", "Estoquista", "tarde", "920000001"],
  [1, "Rodrigo Pires", "rodrigo.pires", "Farmacêutico", "manha", "920000002"],
  [2, "Fernanda Rocha", "fernanda.rocha", "Farmacêutica", "integral", "920000003"],
  [2, "Gustavo Lima", "gustavo.lima", "Atendente", "noite", "920000004"],
  [3, "Patrícia Moraes", "patricia.moraes", "Estoquista", "integral", "920000005"],
  [3, "Leonardo Castro", "leonardo.castro", "Atendente", "tarde", "920000006"],
  [4, "Renata Freitas", "renata.freitas", "Farmacêutica", "manha", "920000007"],
  [4, "Vinícius Prado", "vinicius.prado", "Caixa", "tarde", "920000008"],
];

const pedir = async (rota, opcoes) => {
  const resposta = await fetch(API_URL + rota, opcoes).catch(() => null);
  if (!resposta) {
    console.error(`Servidor indisponível em ${API_URL}. Suba o back-end e tente de novo.`);
    process.exit(1);
  }
  return { status: resposta.status, dados: await resposta.json().catch(() => ({})) };
};

const { dados: { farmacia: farmacias = [] } } = await pedir("/farmacia");
const nomeDaFarmacia = new Map(farmacias.map((f) => [Number(f.idFarmacia), f.nomeFarmacia]));
const { dados: { funcionario: existentes = [] } } = await pedir("/funcionario");
const porEmail = new Map(existentes.map((f) => [String(f.emailFuncionario).toLowerCase(), f]));

let criados = 0;
for (const [idFarmacia, nome, usuario, cargo, turno, baseCpf] of FUNCIONARIOS) {
  const email = `${usuario}@teste.intermedi.com`;
  const farmacia = nomeDaFarmacia.get(idFarmacia) ?? `farmácia ${idFarmacia}`;
  const ja = porEmail.get(email);
  if (ja) {
    console.log(`já existe  ${nome.padEnd(16)} ${farmacia.padEnd(26)} matrícula ${ja.matriculaFuncionario}`);
    continue;
  }
  if (!nomeDaFarmacia.has(idFarmacia)) {
    console.log(`ignorado   ${nome.padEnd(16)} (não existe farmácia ${idFarmacia} neste banco)`);
    continue;
  }
  const { status, dados } = await pedir("/funcionario", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nomeFuncionario: nome,
      cpfFuncionario: cpf(baseCpf),
      emailFuncionario: email,
      telFuncionario: `1198765${baseCpf.slice(-4)}`,
      cargoFuncionario: cargo,
      turnoFuncionario: turno,
      fkIdFarmacia: idFarmacia,
    }),
  });
  if (status === 201 || status === 200) {
    criados += 1;
    const matricula = dados.recebido?.matriculaFuncionario ?? dados.funcionario?.matriculaFuncionario ?? "?";
    console.log(`criado     ${nome.padEnd(16)} ${farmacia.padEnd(26)} ${cargo} · ${turno} · matrícula ${matricula} · CPF ${cpf(baseCpf)}`);
  } else {
    console.error(`erro ${status} ${email}: ${dados.error ?? dados.message ?? ""}`);
    process.exitCode = 1;
  }
}
console.log(`\n${criados} funcionário(s) criado(s) em ${API_URL}.`);
