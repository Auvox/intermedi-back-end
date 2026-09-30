-- =====================================================================
--  INTERMEDI — DADOS DE TESTE (seed)
-- =====================================================================
--  Rodado por: npm run db:reset  (ou npm run db:seed num banco vazio)
--  Todos os usuários abaixo têm a senha:  senha123
--  Todos os nomes, CPFs, CNES e contatos são fictícios.
--
--  Quer mais dados de teste para o time? Adicione aqui e abra PR.
-- =====================================================================

-- senha123
-- (hash gerado com utils/senha.mjs -> gerarHashSenha('senha123'))

INSERT INTO endereco (logradouro, numero, complemento, bairro, cidade, uf, cep) VALUES
    ('Rua das Flores',          '100',  NULL,       'Guaianases',   'São Paulo', 'SP', '08410-000'),  -- 1  Farmácia Pedro João Neto
    ('Av. Central',             '250',  NULL,       'Itaquera',     'São Paulo', 'SP', '08210-000'),  -- 2  Farmácia Vida
    ('Rua Augusta',             '1500', 'Loja 2',   'Consolação',   'São Paulo', 'SP', '01304-001'),  -- 3  Farmácia Saúde Leste
    ('Av. Paulista',            '900',  'Térreo',   'Bela Vista',   'São Paulo', 'SP', '01310-100'),  -- 4  Drogaria Bem Estar
    ('Rua Vergueiro',           '3200', 'Apto 51',  'Vila Mariana', 'São Paulo', 'SP', '04101-300'),  -- 5  gerente Beatriz
    ('Rua Tuiuti',              '450',  NULL,       'Tatuapé',      'São Paulo', 'SP', '03307-000'),  -- 6  gerente Rafael
    ('Rua Serra de Bragança',   '120',  'Casa 3',   'Tatuapé',      'São Paulo', 'SP', '03318-000'),  -- 7  gerente Fernanda
    ('Rua Domingos de Morais',  '800',  NULL,       'Vila Mariana', 'São Paulo', 'SP', '04010-100'),  -- 8  funcionário Pedro
    ('Rua Itapura',             '300',  'Apto 12',  'Tatuapé',      'São Paulo', 'SP', '03310-000'),  -- 9  paciente João
    ('Av. Jacu-Pêssego',        '1800', NULL,       'Itaquera',     'São Paulo', 'SP', '08260-000'),  -- 10 paciente Camila
    ('Rua Cantareira',          '50',   NULL,       'Centro',       'São Paulo', 'SP', '01024-000');  -- 11 paciente Roberto

INSERT INTO admin (nome, email, senha_hash) VALUES
    ('Admin Geral', 'admin@intermedi.com',
     'scrypt$0d2009f9fe0d4248c2f0fcc8fdc371ee$d0b8fdefd3374bbf9d386f4801e12b3b31620f3fbbef2eb5b72c897cd486a629d4e3ef8d8ac9d81d815617d64a3a89c6b27ca1bb4be3578eb9ad08f58ab30d26');

INSERT INTO farmacia (nome, email, telefone, cnes, id_endereco) VALUES
    ('Farmácia Pedro João Neto', 'pjn@intermedi.com',       '1111-1111', '1234567', 1),
    ('Farmácia Vida',            'vida@intermedi.com',      '2222-2222', '7654321', 2),
    ('Farmácia Saúde Leste',     'saudeleste@intermedi.com','3333-3333', '2345678', 3),
    ('Drogaria Bem Estar',       'bemestar@intermedi.com',  '4444-4444', '8765432', 4);

INSERT INTO gerente (nome, cpf, email, senha_hash, crf, matricula, telefone, id_farmacia, id_admin_cadastro, id_endereco) VALUES
    ('Ana Souza',      '111.111.111-11', 'ana@intermedi.com',
     'scrypt$0d2009f9fe0d4248c2f0fcc8fdc371ee$d0b8fdefd3374bbf9d386f4801e12b3b31620f3fbbef2eb5b72c897cd486a629d4e3ef8d8ac9d81d815617d64a3a89c6b27ca1bb4be3578eb9ad08f58ab30d26',
     'CRF-SP 1001', 'G000001', NULL,          1, 1, NULL),
    ('Carlos Lima',    '222.222.222-22', 'carlos@intermedi.com',
     'scrypt$0d2009f9fe0d4248c2f0fcc8fdc371ee$d0b8fdefd3374bbf9d386f4801e12b3b31620f3fbbef2eb5b72c897cd486a629d4e3ef8d8ac9d81d815617d64a3a89c6b27ca1bb4be3578eb9ad08f58ab30d26',
     'CRF-SP 1002', 'G000002', NULL,          2, 1, NULL),
    ('Beatriz Rocha',  '666.666.666-66', 'beatriz@intermedi.com',
     'scrypt$0d2009f9fe0d4248c2f0fcc8fdc371ee$d0b8fdefd3374bbf9d386f4801e12b3b31620f3fbbef2eb5b72c897cd486a629d4e3ef8d8ac9d81d815617d64a3a89c6b27ca1bb4be3578eb9ad08f58ab30d26',
     'CRF-SP 1003', 'G000003', '11977776666', 3, 1, 5),
    ('Rafael Martins', '777.777.777-77', 'rafael@intermedi.com',
     'scrypt$0d2009f9fe0d4248c2f0fcc8fdc371ee$d0b8fdefd3374bbf9d386f4801e12b3b31620f3fbbef2eb5b72c897cd486a629d4e3ef8d8ac9d81d815617d64a3a89c6b27ca1bb4be3578eb9ad08f58ab30d26',
     'CRF-SP 1004', 'G000004', '11966665555', 4, 1, 6),
    ('Fernanda Costa', '888.888.888-88', 'fernanda@intermedi.com',
     'scrypt$0d2009f9fe0d4248c2f0fcc8fdc371ee$d0b8fdefd3374bbf9d386f4801e12b3b31620f3fbbef2eb5b72c897cd486a629d4e3ef8d8ac9d81d815617d64a3a89c6b27ca1bb4be3578eb9ad08f58ab30d26',
     'CRF-SP 1005', 'G000005', '11955554444', 1, 1, 7);

INSERT INTO funcionario (nome, cpf, email, senha_hash, matricula, turno, cargo, telefone, id_farmacia, id_gerente_cadastro, id_endereco) VALUES
    ('Lucas Pereira',        '333.333.333-33', 'lucas@intermedi.com',
     'scrypt$0d2009f9fe0d4248c2f0fcc8fdc371ee$d0b8fdefd3374bbf9d386f4801e12b3b31620f3fbbef2eb5b72c897cd486a629d4e3ef8d8ac9d81d815617d64a3a89c6b27ca1bb4be3578eb9ad08f58ab30d26',
     '000001', 'manha',    'Atendente',    NULL,          1, 1, NULL),
    ('Julia Alves',          '444.444.444-44', 'julia@intermedi.com',
     'scrypt$0d2009f9fe0d4248c2f0fcc8fdc371ee$d0b8fdefd3374bbf9d386f4801e12b3b31620f3fbbef2eb5b72c897cd486a629d4e3ef8d8ac9d81d815617d64a3a89c6b27ca1bb4be3578eb9ad08f58ab30d26',
     '000002', 'tarde',    'Atendente',    NULL,          2, 2, NULL),
    ('Pedro Henrique Silva', '101.202.303-40', 'pedro@intermedi.com',
     'scrypt$0d2009f9fe0d4248c2f0fcc8fdc371ee$d0b8fdefd3374bbf9d386f4801e12b3b31620f3fbbef2eb5b72c897cd486a629d4e3ef8d8ac9d81d815617d64a3a89c6b27ca1bb4be3578eb9ad08f58ab30d26',
     '000003', 'noite',    'Farmacêutico', '11944443333', 1, 1, 8),
    ('Mariana Costa',        '202.303.404-50', 'mariana@intermedi.com',
     'scrypt$0d2009f9fe0d4248c2f0fcc8fdc371ee$d0b8fdefd3374bbf9d386f4801e12b3b31620f3fbbef2eb5b72c897cd486a629d4e3ef8d8ac9d81d815617d64a3a89c6b27ca1bb4be3578eb9ad08f58ab30d26',
     '000004', 'integral', 'Caixa',        '11933332222', 1, 5, NULL),
    ('Thiago Almeida',       '303.404.505-60', 'thiago@intermedi.com',
     'scrypt$0d2009f9fe0d4248c2f0fcc8fdc371ee$d0b8fdefd3374bbf9d386f4801e12b3b31620f3fbbef2eb5b72c897cd486a629d4e3ef8d8ac9d81d815617d64a3a89c6b27ca1bb4be3578eb9ad08f58ab30d26',
     '000005', 'manha',    'Estoquista',   '11922221111', 2, 2, NULL),
    ('Larissa Mendes',       '404.505.606-70', 'larissa@intermedi.com',
     'scrypt$0d2009f9fe0d4248c2f0fcc8fdc371ee$d0b8fdefd3374bbf9d386f4801e12b3b31620f3fbbef2eb5b72c897cd486a629d4e3ef8d8ac9d81d815617d64a3a89c6b27ca1bb4be3578eb9ad08f58ab30d26',
     '000006', 'manha',    'Atendente',    '11911110000', 3, 3, NULL),
    ('Bruno Carvalho',       '505.606.707-80', 'bruno@intermedi.com',
     'scrypt$0d2009f9fe0d4248c2f0fcc8fdc371ee$d0b8fdefd3374bbf9d386f4801e12b3b31620f3fbbef2eb5b72c897cd486a629d4e3ef8d8ac9d81d815617d64a3a89c6b27ca1bb4be3578eb9ad08f58ab30d26',
     '000007', 'tarde',    'Farmacêutico', '11900009999', 3, 3, NULL),
    ('Aline Barbosa',        '606.707.808-90', 'aline@intermedi.com',
     'scrypt$0d2009f9fe0d4248c2f0fcc8fdc371ee$d0b8fdefd3374bbf9d386f4801e12b3b31620f3fbbef2eb5b72c897cd486a629d4e3ef8d8ac9d81d815617d64a3a89c6b27ca1bb4be3578eb9ad08f58ab30d26',
     '000008', 'integral', 'Atendente',    '11988880000', 4, 4, NULL),
    ('Diego Rocha',          '707.808.909-01', 'diego@intermedi.com',
     'scrypt$0d2009f9fe0d4248c2f0fcc8fdc371ee$d0b8fdefd3374bbf9d386f4801e12b3b31620f3fbbef2eb5b72c897cd486a629d4e3ef8d8ac9d81d815617d64a3a89c6b27ca1bb4be3578eb9ad08f58ab30d26',
     '000009', 'noite',    'Estoquista',   '11977770000', 4, 4, NULL);

INSERT INTO categoria (nome, descricao) VALUES
    ('Dor de cabeça',     'Analgésicos para dores leves e moderadas'),                -- 1
    ('Febre',             'Antitérmicos'),                                            -- 2
    ('Alergia',           'Anti-histamínicos'),                                       -- 3
    ('Antibiótico',       'Uso somente com receita (retenção obrigatória)'),          -- 4
    ('Anti-inflamatório', 'Reduzem inflamação, dor e inchaço'),                       -- 5
    ('Hipertensão',       'Controle da pressão arterial'),                            -- 6
    ('Diabetes',          'Controle da glicemia'),                                    -- 7
    ('Estômago',          'Azia, gastrite, refluxo e gases'),                         -- 8
    ('Vitaminas',         'Suplementos vitamínicos');                                 -- 9

-- Os registros ANVISA abaixo são FICTÍCIOS (só seguem o formato oficial)
INSERT INTO remedio (nome, principio_ativo, descricao, dosagem, fabricante, registro_anvisa, tipo, tarja,
                     forma_farmaceutica, via_administracao, apresentacao, indicacoes, contraindicacoes, armazenamento) VALUES
    ('Dipirona', 'dipirona monoidratada', 'Analgésico e antitérmico', '500mg', 'EMS',
     '1.0001.0001.001-1', 'generico', 'sem_tarja', 'comprimido', 'oral', 'Caixa com 10 comprimidos',
     'Dor e febre', 'Alergia à dipirona; gestantes no 3º trimestre', 'Temperatura ambiente (15-30 °C)'),        -- 1
    ('Paracetamol', 'paracetamol', 'Analgésico e antitérmico', '750mg', 'Medley',
     '1.0001.0002.001-2', 'generico', 'sem_tarja', 'comprimido', 'oral', 'Caixa com 20 comprimidos',
     'Dor leve a moderada e febre', 'Doença hepática grave', 'Temperatura ambiente (15-30 °C)'),                -- 2
    ('Loratadina', 'loratadina', 'Antialérgico que não causa sonolência', '10mg', 'Neo Química',
     '1.0001.0003.001-3', 'generico', 'sem_tarja', 'comprimido', 'oral', 'Caixa com 12 comprimidos',
     'Rinite alérgica e urticária', 'Menores de 2 anos', 'Temperatura ambiente (15-30 °C)'),                    -- 3
    ('Ibuprofeno', 'ibuprofeno', 'Anti-inflamatório não esteroidal', '600mg', 'EMS',
     '1.0001.0004.001-4', 'generico', 'vermelha', 'comprimido revestido', 'oral', 'Caixa com 20 comprimidos',
     'Dor, inflamação e febre', 'Úlcera gástrica ativa', 'Temperatura ambiente (15-30 °C)'),                    -- 4
    ('Amoxicilina', 'amoxicilina tri-hidratada', 'Antibiótico de amplo espectro', '500mg', 'Eurofarma',
     '1.0001.0005.001-5', 'generico', 'vermelha_retencao', 'cápsula', 'oral', 'Caixa com 21 cápsulas',
     'Infecções bacterianas', 'Alergia a penicilinas', 'Temperatura ambiente, longe da umidade'),               -- 5
    ('Losartana Potássica', 'losartana potássica', 'Anti-hipertensivo', '50mg', 'Medley',
     '1.0001.0006.001-6', 'generico', 'vermelha', 'comprimido revestido', 'oral', 'Caixa com 30 comprimidos',
     'Hipertensão arterial', 'Gravidez', 'Temperatura ambiente (15-30 °C)'),                                    -- 6
    ('Metformina', 'cloridrato de metformina', 'Antidiabético oral', '850mg', 'Merck',
     '1.0001.0007.001-7', 'referencia', 'vermelha', 'comprimido', 'oral', 'Caixa com 30 comprimidos',
     'Diabetes tipo 2', 'Insuficiência renal grave', 'Temperatura ambiente (15-30 °C)'),                        -- 7
    ('Omeprazol', 'omeprazol', 'Reduz a acidez do estômago', '20mg', 'Aché',
     '1.0001.0008.001-8', 'similar', 'vermelha', 'cápsula', 'oral', 'Caixa com 28 cápsulas',
     'Gastrite, úlcera e refluxo', 'Alergia ao omeprazol', 'Temperatura ambiente, longe da umidade'),            -- 8
    ('Azitromicina', 'azitromicina di-hidratada', 'Antibiótico', '500mg', 'Eurofarma',
     '1.0001.0009.001-9', 'generico', 'vermelha_retencao', 'comprimido revestido', 'oral', 'Caixa com 3 comprimidos',
     'Infecções respiratórias e de pele', 'Alergia a macrolídeos', 'Temperatura ambiente (15-30 °C)'),           -- 9
    ('Nimesulida', 'nimesulida', 'Anti-inflamatório e analgésico', '100mg', 'Neo Química',
     '1.0001.0010.001-0', 'generico', 'vermelha', 'comprimido', 'oral', 'Caixa com 12 comprimidos',
     'Dor e inflamação', 'Menores de 12 anos; doença hepática', 'Temperatura ambiente (15-30 °C)'),              -- 10
    ('Cetirizina', 'dicloridrato de cetirizina', 'Antialérgico', '10mg', 'Medley',
     '1.0001.0011.001-1', 'generico', 'sem_tarja', 'comprimido revestido', 'oral', 'Caixa com 10 comprimidos',
     'Rinite alérgica e urticária', 'Insuficiência renal grave', 'Temperatura ambiente (15-30 °C)'),            -- 11
    ('Enalapril', 'maleato de enalapril', 'Anti-hipertensivo', '10mg', 'Biosintética',
     '1.0001.0012.001-2', 'similar', 'vermelha', 'comprimido', 'oral', 'Caixa com 30 comprimidos',
     'Hipertensão e insuficiência cardíaca', 'Gravidez; histórico de angioedema', 'Temperatura ambiente (15-30 °C)'), -- 12
    ('Vitamina C', 'ácido ascórbico', 'Suplemento de ácido ascórbico', '1g', 'Cimed',
     '1.0001.0013.001-3', 'similar', 'sem_tarja', 'comprimido efervescente', 'oral', 'Tubo com 10 comprimidos',
     'Suplementação de vitamina C', 'Cálculo renal', 'Local seco, com o tubo bem fechado'),                     -- 13
    ('Simeticona', 'simeticona', 'Alívio de gases', '125mg', 'Cimed',
     '1.0001.0014.001-4', 'similar', 'sem_tarja', 'cápsula gelatinosa', 'oral', 'Caixa com 10 cápsulas',
     'Excesso de gases', 'Alergia à simeticona', 'Temperatura ambiente (15-30 °C)'),                            -- 14
    ('Dexclorfeniramina', 'maleato de dexclorfeniramina', 'Antialérgico', '2mg', 'EMS',
     '1.0001.0015.001-5', 'generico', 'vermelha', 'comprimido', 'oral', 'Caixa com 20 comprimidos',
     'Alergias, coceira e rinite', 'Recém-nascidos; lactantes', 'Temperatura ambiente (15-30 °C)');            -- 15

INSERT INTO remedio_categoria (id_remedio, id_categoria) VALUES
    (1, 1), (1, 2),   -- Dipirona: dor de cabeça e febre
    (2, 1), (2, 2),   -- Paracetamol: dor de cabeça e febre
    (3, 3),           -- Loratadina: alergia
    (4, 1), (4, 5),   -- Ibuprofeno: dor de cabeça e anti-inflamatório
    (5, 4),           -- Amoxicilina: antibiótico
    (6, 6),           -- Losartana: hipertensão
    (7, 7),           -- Metformina: diabetes
    (8, 8),           -- Omeprazol: estômago
    (9, 4),           -- Azitromicina: antibiótico
    (10, 5), (10, 2), -- Nimesulida: anti-inflamatório e febre
    (11, 3),          -- Cetirizina: alergia
    (12, 6),          -- Enalapril: hipertensão
    (13, 9),          -- Vitamina C: vitaminas
    (14, 8),          -- Simeticona: estômago
    (15, 3);          -- Dexclorfeniramina: alergia

-- Cada gerente cadastrou os remédios do catálogo na própria farmácia
INSERT INTO estoque (id_remedio, id_farmacia, quantidade, estoque_minimo, lote, validade, id_gerente_cadastro) VALUES
    -- Farmácia Pedro João Neto (1) — gerente Ana (1)
    (1,  1, 120, 30, 'L-A1', '2027-06-30', 1),
    (2,  1,  40, 50, 'L-B1', '2027-03-31', 1),   -- crítico (40 <= 50)
    (4,  1,  85, 20, 'L-D1', '2027-01-31', 1),
    (6,  1, 200, 40, 'L-F1', '2027-08-31', 1),
    (8,  1,  65, 20, 'L-H1', '2026-12-31', 1),
    (13, 1,  30, 20, 'L-M1', '2026-11-30', 1),
    -- Farmácia Vida (2) — gerente Carlos (2)
    (3,  2,  60, 20, 'L-C1', '2027-05-31', 2),
    (1,  2,  15, 30, 'L-A2', '2027-04-30', 2),   -- crítico
    (5,  2,  90, 20, 'L-E1', '2026-12-31', 2),
    (7,  2, 150, 40, 'L-G1', '2027-09-30', 2),
    (11, 2,  45, 20, 'L-K1', '2027-02-28', 2),
    (14, 2,   0, 10, 'L-N1', '2027-01-31', 2),   -- zerado
    -- Farmácia Saúde Leste (3) — gerente Beatriz (3)
    (1,  3, 300, 50, 'L-A3', '2027-07-31', 3),
    (2,  3, 180, 50, 'L-B3', '2027-05-31', 3),
    (5,  3,   8, 20, 'L-E3', '2026-12-31', 3),   -- crítico
    (9,  3,  25, 20, 'L-I1', '2027-03-31', 3),
    (10, 3,  70, 20, 'L-J1', '2027-01-31', 3),
    (12, 3, 110, 30, 'L-L1', '2027-10-31', 3),
    -- Drogaria Bem Estar (4) — gerente Rafael (4)
    (4,  4,  55, 20, 'L-D4', '2027-02-28', 4),
    (6,  4,  12, 30, 'L-F4', '2027-06-30', 4),   -- crítico
    (7,  4,  95, 30, 'L-G4', '2027-04-30', 4),
    (8,  4, 140, 30, 'L-H4', '2027-08-31', 4),
    (15, 4,  35, 20, 'L-O1', '2027-01-31', 4),
    (13, 4,  60, 20, 'L-M4', '2026-08-31', 4);   -- lote VENCIDO (não pode ser entregue)

INSERT INTO paciente (nome, cpf, email, senha_hash, telefone, medicamento_frequente, id_endereco) VALUES
    ('Maria Santos',     '555.555.555-55', 'maria@intermedi.com',
     'scrypt$0d2009f9fe0d4248c2f0fcc8fdc371ee$d0b8fdefd3374bbf9d386f4801e12b3b31620f3fbbef2eb5b72c897cd486a629d4e3ef8d8ac9d81d815617d64a3a89c6b27ca1bb4be3578eb9ad08f58ab30d26',
     '11988887777', NULL, NULL),
    ('João Oliveira',    '808.909.101-12', 'joao@intermedi.com',
     'scrypt$0d2009f9fe0d4248c2f0fcc8fdc371ee$d0b8fdefd3374bbf9d386f4801e12b3b31620f3fbbef2eb5b72c897cd486a629d4e3ef8d8ac9d81d815617d64a3a89c6b27ca1bb4be3578eb9ad08f58ab30d26',
     '11987654321', 'Losartana Potássica', 9),
    ('Camila Ferreira',  '909.101.212-23', 'camila@intermedi.com',
     'scrypt$0d2009f9fe0d4248c2f0fcc8fdc371ee$d0b8fdefd3374bbf9d386f4801e12b3b31620f3fbbef2eb5b72c897cd486a629d4e3ef8d8ac9d81d815617d64a3a89c6b27ca1bb4be3578eb9ad08f58ab30d26',
     '11976543210', 'Loratadina', 10),
    ('Roberto Nunes',    '121.232.343-45', 'roberto@intermedi.com',
     'scrypt$0d2009f9fe0d4248c2f0fcc8fdc371ee$d0b8fdefd3374bbf9d386f4801e12b3b31620f3fbbef2eb5b72c897cd486a629d4e3ef8d8ac9d81d815617d64a3a89c6b27ca1bb4be3578eb9ad08f58ab30d26',
     '11965432109', 'Metformina', 11),
    -- Paciente cadastrada no balcão: sem login no app
    ('Patrícia Gomes',   '232.343.454-56', NULL, NULL,
     '11954321098', NULL, NULL),
    ('Gabriel Ribeiro',  '343.454.565-67', 'gabriel@intermedi.com',
     'scrypt$0d2009f9fe0d4248c2f0fcc8fdc371ee$d0b8fdefd3374bbf9d386f4801e12b3b31620f3fbbef2eb5b72c897cd486a629d4e3ef8d8ac9d81d815617d64a3a89c6b27ca1bb4be3578eb9ad08f58ab30d26',
     '11943210987', NULL, NULL);

INSERT INTO chamado (titulo, descricao, status, prioridade, data_abertura, id_funcionario, id_farmacia,
                     id_gerente_resposta, data_resposta, resposta_gerente) VALUES
    ('Falta de paracetamol',                   'Estoque baixo',                                       'pendente',     'alta',    '2026-09-20 09:15:00', 1, 1, NULL, NULL, NULL),
    ('Reposição de amoxicilina',               'Restam apenas 8 unidades no lote L-E3',               'em_andamento', 'urgente', '2026-09-22 14:30:00', 6, 3, 3, '2026-09-22 15:00:00', 'Pedido feito ao distribuidor'),
    ('Dipirona acabando',                      'Lote L-A2 com 15 unidades, alta procura na semana',   'aceito',       'media',   '2026-09-24 10:00:00', 2, 2, 2, '2026-09-24 11:30:00', NULL),
    ('Pedido de losartana',                    'Clientes hipertensos sem o remédio no fim de semana', 'resolvido',    'alta',    '2026-09-10 08:45:00', 8, 4, 4, '2026-09-10 09:10:00', 'Redistribuição da farmácia 1'),
    ('Simeticona zerada',                      'Lote L-N1 sem unidades',                              'pendente',     'baixa',   '2026-09-25 16:20:00', 5, 2, NULL, NULL, NULL),
    ('Leitor de código de barras com defeito', 'Caixa 2 não lê as embalagens',                        'cancelado',    'baixa',   '2026-09-05 11:00:00', 4, 1, NULL, NULL, NULL),
    ('Mais vitamina C',                        'Procura subiu com o frio',                            'recusado',     'baixa',   '2026-09-12 13:00:00', 3, 1, 1, '2026-09-12 17:00:00', 'Estoque atual ainda atende a demanda');

INSERT INTO chamado_remedio (id_chamado, id_remedio, quantidade) VALUES
    (1, 2,  50),
    (2, 5, 100),
    (3, 1,  60),
    (4, 6,  80),
    (5, 14, 40),
    (7, 13, 50);

INSERT INTO servico (id_funcionario, id_paciente, id_farmacia, observacao, data_servico) VALUES
    (1, 1, 1, NULL,                                   '2026-09-18 10:05:00'),
    (2, 2, 2, 'Retirada mensal',                      '2026-09-19 15:40:00'),
    (6, 3, 3, 'Crise alérgica, orientada a voltar se piorar', '2026-09-21 09:30:00'),
    (8, 4, 4, 'Uso contínuo',                         '2026-09-23 18:10:00'),
    (3, 5, 1, 'Atendimento no balcão',                '2026-09-24 21:00:00'),
    (7, 6, 3, 'Receita de antibiótico retida',        '2026-09-26 14:15:00'),
    (1, 2, 1, NULL,                                   '2026-09-27 08:50:00');

INSERT INTO servico_remedio (id_servico, id_remedio, quantidade) VALUES
    (1, 1, 2), (1, 2, 1),
    (2, 6, 2),
    (3, 3, 1), (3, 11, 1),
    (4, 7, 3),
    (5, 4, 1), (5, 8, 1),
    (6, 9, 1),
    (7, 6, 1), (7, 13, 1);

INSERT INTO redistribuicao (id_remedio, id_farmacia_origem, id_farmacia_destino, quantidade, status,
                            data_solicitacao, data_aprovacao, data_envio, data_recebimento) VALUES
    (6, 1, 4,  80, 'recebida',   '2026-09-10 09:00:00', '2026-09-10 11:00:00', '2026-09-11 08:00:00', '2026-09-11 15:30:00'),
    (1, 3, 2,  60, 'enviada',    '2026-09-24 10:30:00', '2026-09-24 13:00:00', '2026-09-25 09:00:00', NULL),
    (5, 2, 3,  40, 'aprovada',   '2026-09-22 15:00:00', '2026-09-23 10:00:00', NULL,                  NULL),
    (2, 3, 1,  50, 'solicitada', '2026-09-26 17:45:00', NULL,                  NULL,                  NULL),
    (8, 4, 1,  30, 'recusada',   '2026-09-15 12:00:00', NULL,                  NULL,                  NULL);
