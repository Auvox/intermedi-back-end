-- =====================================================================
--  INTERMEDI — DADOS DE TESTE (seed)
-- =====================================================================
--  Rodado por: npm run db:reset  (ou npm run db:seed num banco vazio)
--  Todos os usuários abaixo têm a senha:  senha123
--
--  Quer mais dados de teste para o time? Adicione aqui e abra PR.
-- =====================================================================

-- senha123
-- (hash gerado com utils/senha.mjs -> gerarHashSenha('senha123'))

INSERT INTO endereco (logradouro, numero, bairro, cidade, uf, cep) VALUES
    ('Rua das Flores', '100', 'Guaianases', 'São Paulo', 'SP', '08410-000'),
    ('Av. Central',    '250', 'Itaquera',   'São Paulo', 'SP', '08210-000');

INSERT INTO admin (nome, email, senha_hash) VALUES
    ('Admin Geral', 'admin@intermedi.com',
     'scrypt$0d2009f9fe0d4248c2f0fcc8fdc371ee$d0b8fdefd3374bbf9d386f4801e12b3b31620f3fbbef2eb5b72c897cd486a629d4e3ef8d8ac9d81d815617d64a3a89c6b27ca1bb4be3578eb9ad08f58ab30d26');

INSERT INTO farmacia (nome, email, telefone, cnes, id_endereco) VALUES
    ('Farmácia Pedro João Neto', 'pjn@intermedi.com',  '1111-1111', '1234567', 1),
    ('Farmácia Vida',            'vida@intermedi.com', '2222-2222', '7654321', 2);

INSERT INTO gerente (nome, cpf, email, senha_hash, crf, matricula, id_farmacia, id_admin_cadastro) VALUES
    ('Ana Souza',   '111.111.111-11', 'ana@intermedi.com',
     'scrypt$0d2009f9fe0d4248c2f0fcc8fdc371ee$d0b8fdefd3374bbf9d386f4801e12b3b31620f3fbbef2eb5b72c897cd486a629d4e3ef8d8ac9d81d815617d64a3a89c6b27ca1bb4be3578eb9ad08f58ab30d26',
     'CRF-SP 1001', 'G000001', 1, 1),
    ('Carlos Lima', '222.222.222-22', 'carlos@intermedi.com',
     'scrypt$0d2009f9fe0d4248c2f0fcc8fdc371ee$d0b8fdefd3374bbf9d386f4801e12b3b31620f3fbbef2eb5b72c897cd486a629d4e3ef8d8ac9d81d815617d64a3a89c6b27ca1bb4be3578eb9ad08f58ab30d26',
     'CRF-SP 1002', 'G000002', 2, 1);

INSERT INTO funcionario (nome, cpf, email, senha_hash, matricula, turno, cargo, id_farmacia, id_gerente_cadastro) VALUES
    ('Lucas Pereira', '333.333.333-33', 'lucas@intermedi.com',
     'scrypt$0d2009f9fe0d4248c2f0fcc8fdc371ee$d0b8fdefd3374bbf9d386f4801e12b3b31620f3fbbef2eb5b72c897cd486a629d4e3ef8d8ac9d81d815617d64a3a89c6b27ca1bb4be3578eb9ad08f58ab30d26',
     '000001', 'manha', 'Atendente', 1, 1),
    ('Julia Alves',   '444.444.444-44', 'julia@intermedi.com',
     'scrypt$0d2009f9fe0d4248c2f0fcc8fdc371ee$d0b8fdefd3374bbf9d386f4801e12b3b31620f3fbbef2eb5b72c897cd486a629d4e3ef8d8ac9d81d815617d64a3a89c6b27ca1bb4be3578eb9ad08f58ab30d26',
     '000002', 'tarde', 'Atendente', 2, 2);

INSERT INTO categoria (nome) VALUES ('Dor de cabeça'), ('Febre'), ('Alergia');

INSERT INTO remedio (nome, dosagem, fabricante) VALUES
    ('Dipirona',    '500mg', 'EMS'),
    ('Paracetamol', '750mg', 'Medley'),
    ('Loratadina',  '10mg',  'Neo Química');

INSERT INTO remedio_categoria (id_remedio, id_categoria) VALUES
    (1, 1), (1, 2),   -- Dipirona: dor de cabeça e febre
    (2, 1), (2, 2),   -- Paracetamol: dor de cabeça e febre
    (3, 3);           -- Loratadina: alergia

INSERT INTO estoque (id_remedio, id_farmacia, lote, quantidade) VALUES
    (1, 1, 'L-A1', 120),
    (2, 1, 'L-B1',  40),
    (3, 2, 'L-C1',  60);

INSERT INTO paciente (nome, cpf, email, senha_hash, telefone) VALUES
    ('Maria Santos', '555.555.555-55', 'maria@intermedi.com',
     'scrypt$0d2009f9fe0d4248c2f0fcc8fdc371ee$d0b8fdefd3374bbf9d386f4801e12b3b31620f3fbbef2eb5b72c897cd486a629d4e3ef8d8ac9d81d815617d64a3a89c6b27ca1bb4be3578eb9ad08f58ab30d26',
     '11988887777');

INSERT INTO chamado (titulo, descricao, prioridade, id_funcionario, id_farmacia) VALUES
    ('Falta de paracetamol', 'Estoque baixo', 'alta', 1, 1);
INSERT INTO chamado_remedio (id_chamado, id_remedio, quantidade) VALUES (1, 2, 50);

INSERT INTO servico (id_funcionario, id_paciente, id_farmacia) VALUES (1, 1, 1);
INSERT INTO servico_remedio (id_servico, id_remedio, quantidade) VALUES (1, 1, 2), (1, 2, 1);
