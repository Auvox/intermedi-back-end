CREATE TABLE tbEndereco (
    idEndereco INTEGER PRIMARY KEY AUTOINCREMENT,
    logradouroEndereco VARCHAR(150),
    numeroEndereco VARCHAR(20),
    bairroEndereco VARCHAR(100),
    cidadeEndereco VARCHAR(100),
    estadoEndereco VARCHAR(100),
    ufEndereco CHAR(2),
    cepEndereco VARCHAR(10),
    complementoEndereco VARCHAR(150)
);
CREATE TABLE tbFarmacia (
    idFarmacia INTEGER PRIMARY KEY AUTOINCREMENT,
    nomeFarmacia VARCHAR(150) NOT NULL,
    cnesFarmacia VARCHAR(50),
    telFarmacia VARCHAR(20),
    fkIdEndereco INTEGER, senhaFarmacia TEXT, idGerente INTEGER, cepFarmacia TEXT, enderecoFarmacia TEXT, numeroFarmacia TEXT, complementoFarmacia TEXT, bairroFarmacia TEXT, cidadeFarmacia TEXT, emailFarmacia TEXT,
    
    FOREIGN KEY (fkIdEndereco)
        REFERENCES tbEndereco(idEndereco)
);
CREATE TABLE tbAdmin (
    idAdmin INTEGER PRIMARY KEY AUTOINCREMENT,
    nomeAdmin VARCHAR(150) NOT NULL,
    emailAdmin VARCHAR(150) NOT NULL UNIQUE,
    senhaAdmin VARCHAR(255) NOT NULL
);
CREATE TABLE tbFuncionario (
    idFuncionario INTEGER PRIMARY KEY AUTOINCREMENT,
    nomeFuncionario VARCHAR(150) NOT NULL,
    cpfFuncionario VARCHAR(14) NOT NULL UNIQUE,
    emailFuncionario VARCHAR(150) NOT NULL UNIQUE,
    matriculaFuncionario VARCHAR(255) NOT NULL,
    telFuncionario VARCHAR(20),
    cargoFuncionario VARCHAR(100),
    createAtFuncionario DATETIME DEFAULT CURRENT_TIMESTAMP,

    fkIdEndereco INTEGER,
    fkIdFarmacia INTEGER, turnoFuncionario TEXT,

    FOREIGN KEY (fkIdEndereco)
        REFERENCES tbEndereco(idEndereco),

    FOREIGN KEY (fkIdFarmacia)
        REFERENCES tbFarmacia(idFarmacia)
);
CREATE TABLE tbGerente (
    idGerente INTEGER PRIMARY KEY AUTOINCREMENT,
    nomeGerente VARCHAR(150) NOT NULL,
    emailGerente VARCHAR(150) NOT NULL UNIQUE,
    senhaGerente VARCHAR(255) NOT NULL,
    createdAtGerente DATETIME DEFAULT CURRENT_TIMESTAMP,

    fkIdFuncionario INTEGER, cpfGerente TEXT, crfGerente TEXT, cepGerente TEXT, enderecoGerente TEXT, numeroGerente TEXT, complementoGerente TEXT, bairroGerente TEXT, cidadeGerente TEXT,

    FOREIGN KEY (fkIdFuncionario)
        REFERENCES tbFuncionario(idFuncionario)
);
CREATE TABLE tbCadastroGerenteFarmacia (
    idCadastroGerenteFarmacia INTEGER PRIMARY KEY AUTOINCREMENT,

    fkIdFarmacia INTEGER,
    fkIdGerente INTEGER,

    FOREIGN KEY (fkIdFarmacia)
        REFERENCES tbFarmacia(idFarmacia),

    FOREIGN KEY (fkIdGerente)
        REFERENCES tbGerente(idGerente)
);
CREATE TABLE tbCategoria (
    idCategoria INTEGER PRIMARY KEY AUTOINCREMENT,
    nomeCategoria VARCHAR(150) NOT NULL,
    descCategoria TEXT
);
CREATE TABLE tbCadastroRemedio (
    idRemedio INTEGER PRIMARY KEY AUTOINCREMENT,
    nomeRemedio VARCHAR(150) NOT NULL,
    descRemedio TEXT,
    dosagemRemedio VARCHAR(100),
    fabricanteRemedio VARCHAR(150),
    createdAtRemedio DATETIME DEFAULT CURRENT_TIMESTAMP,

    fkIdGerente INTEGER,

    FOREIGN KEY (fkIdGerente)
        REFERENCES tbGerente(idGerente)
);
CREATE TABLE tbEstoque (
    idEstoque INTEGER PRIMARY KEY AUTOINCREMENT,
    quantEstoque INTEGER,
    dataValidadeEstoque DATE,
    loteEstoque VARCHAR(50),

    fkIdRemedio INTEGER,
    fkIdFarmacia INTEGER,

    FOREIGN KEY (fkIdRemedio)
        REFERENCES tbCadastroRemedio(idRemedio),

    FOREIGN KEY (fkIdFarmacia)
        REFERENCES tbFarmacia(idFarmacia)
);
CREATE TABLE tbRemedioCategoria (
    idRemedioCategoria INTEGER PRIMARY KEY AUTOINCREMENT,

    fkIdRemedio INTEGER,
    fkIdCategoria INTEGER,

    FOREIGN KEY (fkIdRemedio)
        REFERENCES tbCadastroRemedio(idRemedio),

    FOREIGN KEY (fkIdCategoria)
        REFERENCES tbCategoria(idCategoria)
);
CREATE TABLE tbComposicao (
    idComposicao INTEGER PRIMARY KEY AUTOINCREMENT,
    quantidadeComposicao DECIMAL(10,2),
    descricaoComposicao TEXT,
    principioAtivoComposicao VARCHAR(150),
    unidadeComposicao VARCHAR(50),

    fkIdRemedio INTEGER,

    FOREIGN KEY (fkIdRemedio)
        REFERENCES tbCadastroRemedio(idRemedio)
);
CREATE TABLE tbPaciente (
    idPaciente INTEGER PRIMARY KEY AUTOINCREMENT,
    nomePaciente VARCHAR(150) NOT NULL,
    cpfPaciente VARCHAR(14) NOT NULL UNIQUE,
    telPaciente VARCHAR(20),
    createdAtPaciente DATETIME DEFAULT CURRENT_TIMESTAMP,

    fkIdEndereco INTEGER, medicamentoFrequentePaciente TEXT, senhaPaciente TEXT, cepPaciente TEXT, ruaPaciente TEXT, numeroPaciente TEXT, bairroPaciente TEXT, cidadePaciente TEXT, estadoPaciente TEXT, complementoPaciente TEXT, emailPaciente TEXT,

    FOREIGN KEY (fkIdEndereco)
        REFERENCES tbEndereco(idEndereco)
);
CREATE TABLE tbChamado (
    idChamado INTEGER PRIMARY KEY AUTOINCREMENT,
    tituloChamado VARCHAR(200) NOT NULL,
    descChamado TEXT,
    statusChamado VARCHAR(50),
    prioridadeChamado VARCHAR(50),
    dataAberturaChamado DATETIME DEFAULT CURRENT_TIMESTAMP,
    dataFechamentoChamado DATETIME,

    fkIdRemedio INTEGER,
    fkIdFuncionario INTEGER,
    fkIdFarmaciaSolicitante INTEGER,

    FOREIGN KEY (fkIdRemedio)
        REFERENCES tbCadastroRemedio(idRemedio),

    FOREIGN KEY (fkIdFuncionario)
        REFERENCES tbFuncionario(idFuncionario),

    FOREIGN KEY (fkIdFarmaciaSolicitante)
        REFERENCES tbFarmacia(idFarmacia)
);
CREATE TABLE tbLog (
    idLog INTEGER PRIMARY KEY AUTOINCREMENT,
    tabelaAfetadaLog VARCHAR(100),
    tipoOperacaoLog VARCHAR(50),
    descLog TEXT,
    dataLog DATETIME DEFAULT CURRENT_TIMESTAMP,

    fkIdRemedio INTEGER,
    fkIdFuncionario INTEGER,

    FOREIGN KEY (fkIdRemedio)
        REFERENCES tbCadastroRemedio(idRemedio),

    FOREIGN KEY (fkIdFuncionario)
        REFERENCES tbFuncionario(idFuncionario)
);
CREATE TABLE tbRedistribuicao (
    idRedistribuicao INTEGER PRIMARY KEY AUTOINCREMENT,
    quantRedistribuicao INTEGER NOT NULL,
    dataRedistribuicao DATETIME DEFAULT CURRENT_TIMESTAMP,
    solicitacaoRedistribuicao TEXT,
    dataAprovacaoRedistribuicao DATETIME,
    dataEnvioRedistribuicao DATETIME,
    dataRecebimentoRedistribuicao DATETIME,
    statusRedistribuicao VARCHAR(50),

    fkIdChamado INTEGER UNIQUE,
    fkIdFarmaciaOrigem INTEGER NOT NULL,
    fkIdFarmaciaDestino INTEGER NOT NULL,
    fkIdGerente INTEGER,

    FOREIGN KEY (fkIdChamado)
        REFERENCES tbChamado(idChamado),

    FOREIGN KEY (fkIdFarmaciaOrigem)
        REFERENCES tbFarmacia(idFarmacia),

    FOREIGN KEY (fkIdFarmaciaDestino)
        REFERENCES tbFarmacia(idFarmacia),

    FOREIGN KEY (fkIdGerente)
        REFERENCES tbGerente(idGerente)
);