-- =====================================================================
--  INTERMEDI — SCHEMA DO BANCO (SQLite)
-- =====================================================================
--  Este arquivo cria TODAS as tabelas. Ele é executado:
--    • automaticamente sempre que o servidor sobe (database/database.mjs)
--    • pelos comandos npm run db:init / db:seed / db:reset
--
--  Pode rodar quantas vezes quiser: tudo usa IF NOT EXISTS.
--
--  ATENÇÃO: "IF NOT EXISTS" não altera tabela que já existe.
--  Mudou uma tabela aqui? Avise o time para rodar: npm run db:reset
--
--  Índice:
--    PARTE 0 — Configuração
--    PARTE 1 — Tabelas base (endereco, admin, farmacia, categoria, paciente)
--    PARTE 2 — Pessoas ligadas à farmácia (gerente, funcionario)
--    PARTE 3 — Remédios e estoque (remedio, remedio_categoria, estoque)
--    PARTE 4 — Chamados (chamado, chamado_remedio)
--    PARTE 5 — Serviços (servico, servico_remedio)
--    PARTE 6 — Redistribuição
--    PARTE 7 — Sessões do app do paciente
--    PARTE 8 — Índices
--
--  Dados de teste ficam em database/seed.sql
--  Consultas de referência ficam em database/consultas.sql
-- =====================================================================


-- =====================================================================
--  PARTE 0 — CONFIGURAÇÃO
-- =====================================================================
PRAGMA foreign_keys = ON;


-- =====================================================================
--  PARTE 1 — TABELAS BASE
-- =====================================================================

-- ---------------------------------------------------------------------
--  1.1 ENDERECO
--  Cada entidade (admin, gerente, funcionario, farmacia, paciente)
--  aponta para um endereço via id_endereco.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS endereco (
    id_endereco  INTEGER PRIMARY KEY AUTOINCREMENT,
    logradouro   TEXT    NOT NULL,
    numero       TEXT    NOT NULL,
    complemento  TEXT,
    bairro       TEXT    NOT NULL,
    cidade       TEXT    NOT NULL,
    uf           TEXT    NOT NULL CHECK (length(uf) = 2),
    cep          TEXT    NOT NULL,
    latitude     REAL CHECK (latitude BETWEEN -90 AND 90),
    longitude    REAL CHECK (longitude BETWEEN -180 AND 180)
);

-- ---------------------------------------------------------------------
--  1.2 ADMIN
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin (
    id_admin     INTEGER PRIMARY KEY AUTOINCREMENT,
    nome         TEXT    NOT NULL,
    email        TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    senha_hash   TEXT    NOT NULL,          -- nunca salvar senha pura
    telefone     TEXT,
    id_endereco  INTEGER,
    FOREIGN KEY (id_endereco) REFERENCES endereco (id_endereco)
        ON DELETE SET NULL
);

-- ---------------------------------------------------------------------
--  1.3 FARMACIA
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS farmacia (
    id_farmacia  INTEGER PRIMARY KEY AUTOINCREMENT,
    nome         TEXT    NOT NULL,
    email        TEXT    UNIQUE COLLATE NOCASE,
    telefone     TEXT,
    cnes         TEXT    NOT NULL UNIQUE,
    id_endereco  INTEGER,
    foto         TEXT,                     -- URL: /uploads/fotos/<arquivo> (fachada/logo)
    created_at   TEXT    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_endereco) REFERENCES endereco (id_endereco)
        ON DELETE SET NULL
);

-- ---------------------------------------------------------------------
--  1.4 CATEGORIA  (ex.: "Dor de cabeça", "Febre", "Alergia")
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categoria (
    id_categoria INTEGER PRIMARY KEY AUTOINCREMENT,
    nome         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    descricao    TEXT
);

-- ---------------------------------------------------------------------
--  1.5 PACIENTE  (o "cliente" que recebe o serviço)
--  Colunas extras (email, senha_hash, telefone, medicamento_frequente,
--  foto_perfil, id_endereco, created_at) existem porque o APP do
--  paciente faz cadastro/login e edita o perfil.
--  email e senha_hash são opcionais: um paciente cadastrado no balcão
--  da farmácia pode não ter login.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS paciente (
    id_paciente            INTEGER PRIMARY KEY AUTOINCREMENT,
    nome                   TEXT    NOT NULL,
    cpf                    TEXT    NOT NULL UNIQUE,
    email                  TEXT    UNIQUE COLLATE NOCASE,
    senha_hash             TEXT,
    telefone               TEXT,
    medicamento_frequente  TEXT,
    foto_perfil            TEXT,
    id_endereco            INTEGER,
    created_at             TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_endereco) REFERENCES endereco (id_endereco)
        ON DELETE SET NULL
);


-- =====================================================================
--  PARTE 2 — PESSOAS LIGADAS À FARMÁCIA
--  A regra "quem pertence a qual farmácia" mora na coluna id_farmacia.
-- =====================================================================

-- ---------------------------------------------------------------------
--  2.1 GERENTE
--  - Uma farmácia pode ter 1 ou mais gerentes  -> FK id_farmacia (1:N)
--  - O admin cadastra o gerente                -> FK id_admin_cadastro
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gerente (
    id_gerente         INTEGER PRIMARY KEY AUTOINCREMENT,
    nome               TEXT    NOT NULL,
    cpf                TEXT    NOT NULL UNIQUE,
    email              TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    senha_hash         TEXT    NOT NULL,
    crf                TEXT    NOT NULL UNIQUE,
    matricula          TEXT    NOT NULL UNIQUE,
    telefone           TEXT,
    id_farmacia        INTEGER NOT NULL,
    id_admin_cadastro  INTEGER,
    id_endereco        INTEGER,
    foto               TEXT,               -- URL: /uploads/fotos/<arquivo>
    created_at         TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_farmacia)       REFERENCES farmacia (id_farmacia) ON DELETE RESTRICT,
    FOREIGN KEY (id_admin_cadastro) REFERENCES admin    (id_admin)    ON DELETE SET NULL,
    FOREIGN KEY (id_endereco)       REFERENCES endereco (id_endereco) ON DELETE SET NULL
);

-- ---------------------------------------------------------------------
--  2.2 FUNCIONARIO
--  - Pertence a UMA farmácia                   -> FK id_farmacia
--  - O gerente cadastra o funcionário          -> FK id_gerente_cadastro
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS funcionario (
    id_funcionario       INTEGER PRIMARY KEY AUTOINCREMENT,
    nome                 TEXT    NOT NULL,
    cpf                  TEXT    NOT NULL UNIQUE,
    email                TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    senha_hash           TEXT    NOT NULL,
    matricula            TEXT    NOT NULL UNIQUE,
    turno                TEXT    CHECK (turno IN ('manha', 'tarde', 'noite', 'integral')),
    cargo                TEXT,
    telefone             TEXT,
    id_farmacia          INTEGER NOT NULL,
    id_gerente_cadastro  INTEGER,
    id_endereco          INTEGER,
    foto                 TEXT,             -- URL: /uploads/fotos/<arquivo>
    created_at           TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_farmacia)         REFERENCES farmacia (id_farmacia) ON DELETE RESTRICT,
    FOREIGN KEY (id_gerente_cadastro) REFERENCES gerente  (id_gerente)  ON DELETE SET NULL,
    FOREIGN KEY (id_endereco)         REFERENCES endereco (id_endereco) ON DELETE SET NULL
);


-- =====================================================================
--  PARTE 3 — REMÉDIOS E ESTOQUE
-- =====================================================================

-- ---------------------------------------------------------------------
--  3.1 REMEDIO  (catálogo geral, igual para todas as farmácias)
--  Cadastrado pelo ADMIN. Os campos abaixo são as informações exibidas
--  na apresentação do remédio nas demais plataformas.
--  tarja:  sem_tarja          -> venda livre
--          vermelha           -> venda sob prescrição
--          vermelha_retencao  -> prescrição com retenção da receita
--          preta              -> controlado (receita azul/amarela retida)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS remedio (
    id_remedio          INTEGER PRIMARY KEY AUTOINCREMENT,
    nome                TEXT    NOT NULL,          -- nome comercial, ex.: 'Dipirona'
    principio_ativo     TEXT,                      -- ex.: 'dipirona monoidratada'
    descricao           TEXT,
    dosagem             TEXT,                      -- ex.: '500mg'
    fabricante          TEXT,                      -- laboratório
    registro_anvisa     TEXT    UNIQUE,            -- 13 dígitos, ex.: '1.0235.0987.001-3'
    tipo                TEXT    CHECK (tipo IN ('referencia', 'generico', 'similar')),
    tarja               TEXT    NOT NULL DEFAULT 'sem_tarja'
                        CHECK (tarja IN ('sem_tarja', 'vermelha', 'vermelha_retencao', 'preta')),
    forma_farmaceutica  TEXT,                      -- ex.: 'comprimido', 'xarope'
    via_administracao   TEXT,                      -- ex.: 'oral', 'tópica'
    apresentacao        TEXT,                      -- ex.: 'Caixa com 20 comprimidos'
    indicacoes          TEXT,
    contraindicacoes    TEXT,
    armazenamento       TEXT,                      -- ex.: 'Temperatura ambiente (15-30 °C)'
    foto                TEXT,                      -- URL: /uploads/remedios/<arquivo>
    created_at          TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TEXT
);

-- ---------------------------------------------------------------------
--  3.2 REMEDIO_CATEGORIA  (N:N)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS remedio_categoria (
    id_remedio    INTEGER NOT NULL,
    id_categoria  INTEGER NOT NULL,
    PRIMARY KEY (id_remedio, id_categoria),
    FOREIGN KEY (id_remedio)   REFERENCES remedio   (id_remedio)   ON DELETE CASCADE,
    FOREIGN KEY (id_categoria) REFERENCES categoria (id_categoria) ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
--  3.3 ESTOQUE  (quanto de cada remédio cada farmácia tem)
--  Fluxo:
--    1. o ADMIN cadastra o remédio no catálogo geral (tabela remedio)
--    2. o GERENTE adiciona esse remédio no estoque da SUA farmácia
--       (uma linha por remédio por farmácia) com a quantidade
--    3. o FUNCIONÁRIO vê o estoque e, ao registrar um serviço,
--       a quantidade entregue ao paciente é baixada daqui
--  estoque_minimo: abaixo ou igual a este valor o remédio é "crítico".
--  lote/validade: dados do lote atual (opcionais). Vencido não pode ser
--  entregue em serviço.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS estoque (
    id_estoque           INTEGER PRIMARY KEY AUTOINCREMENT,
    id_remedio           INTEGER NOT NULL,
    id_farmacia          INTEGER NOT NULL,
    quantidade           INTEGER NOT NULL DEFAULT 0  CHECK (quantidade >= 0),
    estoque_minimo       INTEGER NOT NULL DEFAULT 20 CHECK (estoque_minimo >= 0),
    lote                 TEXT,
    validade             TEXT,                 -- 'AAAA-MM-DD'
    id_gerente_cadastro  INTEGER,
    created_at           TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TEXT,
    UNIQUE (id_remedio, id_farmacia),
    FOREIGN KEY (id_remedio)          REFERENCES remedio  (id_remedio)  ON DELETE RESTRICT,
    FOREIGN KEY (id_farmacia)         REFERENCES farmacia (id_farmacia) ON DELETE CASCADE,
    FOREIGN KEY (id_gerente_cadastro) REFERENCES gerente  (id_gerente)  ON DELETE SET NULL
);


-- =====================================================================
--  PARTE 4 — CHAMADOS
-- =====================================================================

-- ---------------------------------------------------------------------
--  4.1 CHAMADO
--  O funcionário SOLICITA o chamado (status 'pendente') e o gerente da
--  farmácia aceita ou recusa. Fluxo do status:
--    pendente -> aceito -> em_andamento -> resolvido
--    pendente -> recusado
--    (qualquer um antes de resolvido) -> cancelado
--  id_gerente_resposta / data_resposta / resposta_gerente ficam NULL
--  até o gerente responder.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chamado (
    id_chamado          INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo              TEXT    NOT NULL,
    descricao           TEXT,
    status              TEXT    NOT NULL DEFAULT 'pendente'
                        CHECK (status IN ('pendente', 'aceito', 'em_andamento',
                                          'resolvido', 'recusado', 'cancelado')),
    prioridade          TEXT    NOT NULL DEFAULT 'media'
                        CHECK (prioridade IN ('baixa', 'media', 'alta', 'urgente')),
    data_abertura       TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    id_funcionario      INTEGER NOT NULL,
    id_farmacia         INTEGER NOT NULL,
    id_gerente_resposta INTEGER,             -- gerente que aceitou/recusou
    data_resposta       TEXT,
    resposta_gerente    TEXT,                -- ex.: motivo da recusa
    FOREIGN KEY (id_funcionario)      REFERENCES funcionario (id_funcionario) ON DELETE RESTRICT,
    FOREIGN KEY (id_farmacia)         REFERENCES farmacia    (id_farmacia)    ON DELETE CASCADE,
    FOREIGN KEY (id_gerente_resposta) REFERENCES gerente     (id_gerente)     ON DELETE SET NULL
);

-- ---------------------------------------------------------------------
--  4.2 CHAMADO_REMEDIO  (N:N)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chamado_remedio (
    id_chamado   INTEGER NOT NULL,
    id_remedio   INTEGER NOT NULL,
    quantidade   INTEGER CHECK (quantidade > 0),
    PRIMARY KEY (id_chamado, id_remedio),
    FOREIGN KEY (id_chamado) REFERENCES chamado (id_chamado) ON DELETE CASCADE,
    FOREIGN KEY (id_remedio) REFERENCES remedio (id_remedio) ON DELETE RESTRICT
);


-- =====================================================================
--  PARTE 5 — SERVIÇOS
-- =====================================================================

-- ---------------------------------------------------------------------
--  5.1 SERVICO  (cabeçalho: quem fez, para quem, onde, quando)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS servico (
    id_servico     INTEGER PRIMARY KEY AUTOINCREMENT,
    id_funcionario INTEGER NOT NULL,   -- quem criou o serviço
    id_paciente    INTEGER NOT NULL,   -- cliente atendido
    id_farmacia    INTEGER NOT NULL,   -- farmácia onde foi feito
    observacao     TEXT,
    data_servico   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_funcionario) REFERENCES funcionario (id_funcionario) ON DELETE RESTRICT,
    FOREIGN KEY (id_paciente)    REFERENCES paciente    (id_paciente)    ON DELETE RESTRICT,
    FOREIGN KEY (id_farmacia)    REFERENCES farmacia    (id_farmacia)    ON DELETE CASCADE
);

-- ---------------------------------------------------------------------
--  5.2 SERVICO_REMEDIO  (itens: quais remédios e quanto de cada)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS servico_remedio (
    id_servico   INTEGER NOT NULL,
    id_remedio   INTEGER NOT NULL,
    quantidade   INTEGER NOT NULL CHECK (quantidade > 0),
    PRIMARY KEY (id_servico, id_remedio),
    FOREIGN KEY (id_servico) REFERENCES servico (id_servico) ON DELETE CASCADE,
    FOREIGN KEY (id_remedio) REFERENCES remedio (id_remedio) ON DELETE RESTRICT
);


-- =====================================================================
--  PARTE 6 — REDISTRIBUIÇÃO  (transferência de remédio entre farmácias)
--  Nasce quando o gerente ACEITA um chamado: para cada remédio do chamado
--  é criado um pedido para UMA farmácia que tem o remédio sobrando.
--    origem  = farmácia FORNECEDORA (quem envia)
--    destino = farmácia SOLICITANTE (dona do chamado)
--  Fluxo do status:
--    solicitada -> enviada -> recebida   (fornecedor aceitou; estoque da
--                                         origem sai na hora e o do destino
--                                         entra quando chega, após o tempo
--                                         de entrega)
--    solicitada -> recusada              (o sistema cria outra linha
--                                         'solicitada' para a próxima
--                                         farmácia que tiver o remédio)
--  'aprovada' e 'cancelada' ficam para uso manual/legado.
-- =====================================================================
CREATE TABLE IF NOT EXISTS redistribuicao (
    id_redistribuicao      INTEGER PRIMARY KEY AUTOINCREMENT,
    id_chamado             INTEGER,                 -- chamado que originou o pedido
    id_remedio             INTEGER NOT NULL,
    id_farmacia_origem     INTEGER NOT NULL,
    id_farmacia_destino    INTEGER NOT NULL,
    quantidade             INTEGER NOT NULL CHECK (quantidade > 0),
    status                 TEXT    NOT NULL DEFAULT 'solicitada'
                           CHECK (status IN ('solicitada', 'aprovada', 'enviada',
                                             'recebida', 'recusada', 'cancelada')),
    id_gerente_resposta    INTEGER,                 -- gerente da origem que aceitou/recusou
    motivo_recusa          TEXT,
    data_solicitacao       TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data_aprovacao         TEXT,
    data_recusa            TEXT,
    data_envio             TEXT,
    data_prevista_chegada  TEXT,                    -- data_envio + tempo de entrega
    data_recebimento       TEXT,
    CHECK (id_farmacia_origem <> id_farmacia_destino),
    FOREIGN KEY (id_chamado)          REFERENCES chamado  (id_chamado)  ON DELETE SET NULL,
    FOREIGN KEY (id_remedio)          REFERENCES remedio  (id_remedio)  ON DELETE RESTRICT,
    FOREIGN KEY (id_farmacia_origem)  REFERENCES farmacia (id_farmacia) ON DELETE RESTRICT,
    FOREIGN KEY (id_farmacia_destino) REFERENCES farmacia (id_farmacia) ON DELETE RESTRICT,
    FOREIGN KEY (id_gerente_resposta) REFERENCES gerente  (id_gerente)  ON DELETE SET NULL
);


-- =====================================================================
--  PARTE 7 — SESSÕES DO APP DO PACIENTE  (login por token)
--  Antes era criada em routes/app.routes.mjs (appSessions).
-- =====================================================================
CREATE TABLE IF NOT EXISTS sessao_paciente (
    token_hash        TEXT    PRIMARY KEY,   -- sha256 do token (o token puro nunca é salvo)
    id_paciente       INTEGER NOT NULL,
    senha_fingerprint TEXT    NOT NULL,      -- muda quando a senha muda -> derruba a sessão
    expira_em         INTEGER NOT NULL,      -- timestamp em ms
    FOREIGN KEY (id_paciente) REFERENCES paciente (id_paciente) ON DELETE CASCADE
);


-- =====================================================================
--  PARTE 8 — ÍNDICES  (deixam os filtros por farmácia mais rápidos)
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_gerente_farmacia      ON gerente (id_farmacia);
CREATE INDEX IF NOT EXISTS idx_funcionario_farmacia  ON funcionario (id_farmacia);
CREATE INDEX IF NOT EXISTS idx_estoque_farmacia      ON estoque (id_farmacia);
CREATE INDEX IF NOT EXISTS idx_chamado_farmacia      ON chamado (id_farmacia, status);
CREATE INDEX IF NOT EXISTS idx_servico_farmacia      ON servico (id_farmacia);
CREATE INDEX IF NOT EXISTS idx_remcat_categoria      ON remedio_categoria (id_categoria);
CREATE INDEX IF NOT EXISTS idx_sessao_paciente       ON sessao_paciente (id_paciente);
