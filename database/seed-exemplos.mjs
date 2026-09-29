// Dados fictícios adicionais, sem apagar registros existentes.
// Execute: node --env-file-if-exists=.env database/seed-exemplos.mjs
import db, { emTransacao } from "./database.mjs";
import { gerarHashSenha } from "../utils/senha.mjs";

const tabelas = ["endereco", "admin", "farmacia", "categoria", "paciente",
  "gerente", "funcionario", "remedio", "remedio_categoria", "estoque",
  "chamado", "chamado_remedio", "servico", "servico_remedio", "redistribuicao"];
const inserir = (sql, ...valores) => Number(db.prepare(sql).run(...valores).lastInsertRowid);

try {
  emTransacao(() => {
    if (db.prepare("SELECT 1 FROM admin WHERE email = ?").get("admin1@exemplo.invalid")) {
      console.log("Este conjunto de exemplos já foi inserido; dados preservados.");
      return;
    }
    const senhaHash = gerarHashSenha("senha123");
    const farmacias = [];
    const remedios = [];
    const nomes = ["Aurora", "Jardim", "Horizonte"];
    const medicamentos = [["Dipirona", "500mg"], ["Paracetamol", "750mg"], ["Loratadina", "10mg"]];
    for (let i = 1; i <= 3; i++) {
      const endereco = inserir(
        "INSERT INTO endereco (logradouro, numero, bairro, cidade, uf, cep) VALUES (?, ?, ?, ?, ?, ?)",
        `Rua Fictícia ${nomes[i - 1]}`, String(i * 100), "Bairro Exemplo", "São Paulo", "SP", "01000-000",
      );
      const admin = inserir(
        "INSERT INTO admin (nome, email, senha_hash, id_endereco) VALUES (?, ?, ?, ?)",
        `Administrador Exemplo ${i}`, `admin${i}@exemplo.invalid`, senhaHash, endereco,
      );
      const farmacia = inserir(
        "INSERT INTO farmacia (nome, email, telefone, cnes, id_endereco) VALUES (?, ?, ?, ?, ?)",
        `Farmácia Exemplo ${nomes[i - 1]}`, `farmacia${i}@exemplo.invalid`, `110000000${i}`, `EXEMPLO-${i}`, endereco,
      );
      farmacias.push(farmacia);
      const gerente = inserir(
        "INSERT INTO gerente (nome, cpf, email, senha_hash, crf, matricula, id_farmacia, id_admin_cadastro) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        `Gerente Exemplo ${i}`, `900.000.000-0${i}`, `gerente${i}@exemplo.invalid`, senhaHash,
        `CRF-EXEMPLO-${i}`, `GE-EX-${i}`, farmacia, admin,
      );
      const funcionario = inserir(
        "INSERT INTO funcionario (nome, cpf, email, senha_hash, matricula, turno, cargo, id_farmacia, id_gerente_cadastro) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        `Funcionário Exemplo ${i}`, `800.000.000-0${i}`, `funcionario${i}@exemplo.invalid`, senhaHash,
        `FU-EX-${i}`, ["manha", "tarde", "noite"][i - 1], "Atendente", farmacia, gerente,
      );
      const paciente = inserir(
        "INSERT INTO paciente (nome, cpf, email, senha_hash, telefone) VALUES (?, ?, ?, ?, ?)",
        ["Marina Exemplo", "Rafael Exemplo", "Beatriz Exemplo"][i - 1], `700.000.000-0${i}`,
        `paciente${i}@exemplo.invalid`, senhaHash, `1190000000${i}`,
      );
      const categoria = inserir(
        "INSERT INTO categoria (nome, descricao) VALUES (?, ?)",
        `Categoria Exemplo ${i}`, "Categoria fictícia para testes",
      );
      const remedio = inserir(
        "INSERT INTO remedio (nome, descricao, dosagem, fabricante) VALUES (?, ?, ?, ?)",
        medicamentos[i - 1][0], "Registro fictício para testes", medicamentos[i - 1][1], "Laboratório Exemplo",
      );
      remedios.push(remedio);
      inserir("INSERT INTO remedio_categoria (id_remedio, id_categoria) VALUES (?, ?)", remedio, categoria);
      inserir("INSERT INTO estoque (id_remedio, id_farmacia, lote, quantidade) VALUES (?, ?, ?, ?)",
        remedio, farmacia, `LOTE-EX-${i}`, 100 * i);
      const chamado = inserir(
        "INSERT INTO chamado (titulo, descricao, prioridade, id_funcionario, id_farmacia) VALUES (?, ?, ?, ?, ?)",
        `Reposição de teste ${i}`, "Chamado fictício para demonstração", "media", funcionario, farmacia,
      );
      inserir("INSERT INTO chamado_remedio (id_chamado, id_remedio, quantidade) VALUES (?, ?, ?)", chamado, remedio, 20);
      const servico = inserir(
        "INSERT INTO servico (id_funcionario, id_paciente, id_farmacia, observacao) VALUES (?, ?, ?, ?)",
        funcionario, paciente, farmacia, "Atendimento fictício para testes",
      );
      inserir("INSERT INTO servico_remedio (id_servico, id_remedio, quantidade) VALUES (?, ?, ?)", servico, remedio, i);
    }
    for (let i = 0; i < 3; i++) {
      inserir("INSERT INTO redistribuicao (id_remedio, id_farmacia_origem, id_farmacia_destino, quantidade) VALUES (?, ?, ?, ?)",
        remedios[i], farmacias[i], farmacias[(i + 1) % 3], 10);
    }
    if (db.prepare("PRAGMA foreign_key_check").all().length) {
      throw new Error("Falha na integridade dos relacionamentos; inserção desfeita.");
    }
  });
  for (const tabela of tabelas) {
    console.log(`${tabela}: ${db.prepare(`SELECT COUNT(*) AS total FROM ${tabela}`).get().total}`);
  }
  console.log("Contas fictícias: senha123. Sessões serão criadas pelo login.");
} finally {
  db.close();
}
