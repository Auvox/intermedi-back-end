-- =====================================================================
--  INTERMEDI — CONSULTAS DE REFERÊNCIA (não é executado automaticamente)
-- =====================================================================
--  Consultas prontas (com INNER JOIN) para usar nos services.
--  Os parâmetros ":id_farmacia", ":email" etc. vêm da SESSÃO do usuário
--  logado — nunca do front.
--
--  Para testar no VS Code (extensão SQLite), selecione a consulta,
--  troque o parâmetro por um valor fixo e rode no database/intermedi.db
-- =====================================================================

-- =====================================================================
--  PARTE 10 — CONSULTAS: ADMIN  (vê todas as farmácias)
-- =====================================================================

-- 10.1 Farmácias e seus gerentes
SELECT f.id_farmacia,
       f.nome        AS farmacia,
       f.cnes,
       g.id_gerente,
       g.nome        AS gerente,
       g.email       AS email_gerente
FROM farmacia f
INNER JOIN gerente g ON g.id_farmacia = f.id_farmacia
ORDER BY f.nome, g.nome;

-- 10.2 Farmácias e seus funcionários
SELECT f.id_farmacia,
       f.nome        AS farmacia,
       fu.id_funcionario,
       fu.nome       AS funcionario,
       fu.cargo,
       fu.turno
FROM farmacia f
INNER JOIN funcionario fu ON fu.id_farmacia = f.id_farmacia
ORDER BY f.nome, fu.nome;

-- 10.3 Resumo por farmácia (endereço + gerentes + total de funcionários)
SELECT f.id_farmacia,
       f.nome                                     AS farmacia,
       e.cidade || ' - ' || e.uf                  AS local,
       (SELECT group_concat(g.nome, ', ')
          FROM gerente g
         WHERE g.id_farmacia = f.id_farmacia)     AS gerentes,
       (SELECT COUNT(*)
          FROM funcionario fu
         WHERE fu.id_farmacia = f.id_farmacia)    AS total_funcionarios
FROM farmacia f
INNER JOIN endereco e ON e.id_endereco = f.id_endereco
ORDER BY f.nome;

-- 10.4 Gerentes e qual admin os cadastrou
SELECT g.nome AS gerente, f.nome AS farmacia, a.nome AS cadastrado_por
FROM gerente g
INNER JOIN farmacia f ON f.id_farmacia = g.id_farmacia
INNER JOIN admin    a ON a.id_admin    = g.id_admin_cadastro;


-- =====================================================================
--  PARTE 11 — CONSULTAS: GERENTE  (só a farmácia dele)
--  Fluxo: no login, busca o gerente (11.1) e guarda id_farmacia na
--  sessão. Todas as outras consultas usam esse :id_farmacia.
-- =====================================================================

-- 11.1 Login / dados do gerente + farmácia
SELECT g.id_gerente, g.nome, g.email, g.senha_hash,
       f.id_farmacia, f.nome AS farmacia
FROM gerente g
INNER JOIN farmacia f ON f.id_farmacia = g.id_farmacia
WHERE g.email = :email;

-- 11.2 Informações da farmácia (com endereço)
SELECT f.nome, f.email, f.telefone, f.cnes,
       e.logradouro, e.numero, e.bairro, e.cidade, e.uf, e.cep
FROM farmacia f
INNER JOIN endereco e ON e.id_endereco = f.id_endereco
WHERE f.id_farmacia = :id_farmacia;

-- 11.3 Funcionários da farmácia
SELECT fu.id_funcionario, fu.nome, fu.matricula, fu.cargo, fu.turno, fu.email
FROM funcionario fu
INNER JOIN farmacia f ON f.id_farmacia = fu.id_farmacia
WHERE f.id_farmacia = :id_farmacia
ORDER BY fu.nome;

-- 11.4 Remédios em estoque na farmácia (com categorias)
SELECT r.id_remedio, r.nome, r.dosagem, r.fabricante,
       es.lote, es.quantidade,
       group_concat(c.nome, ', ') AS categorias
FROM estoque es
INNER JOIN remedio           r  ON r.id_remedio    = es.id_remedio
INNER JOIN remedio_categoria rc ON rc.id_remedio   = r.id_remedio
INNER JOIN categoria         c  ON c.id_categoria  = rc.id_categoria
WHERE es.id_farmacia = :id_farmacia
GROUP BY es.id_estoque
ORDER BY r.nome;

-- 11.5 Chamados da farmácia (com quem abriu)
SELECT ch.id_chamado, ch.titulo, ch.status, ch.prioridade, ch.data_abertura,
       fu.nome AS aberto_por
FROM chamado ch
INNER JOIN funcionario fu ON fu.id_funcionario = ch.id_funcionario
WHERE ch.id_farmacia = :id_farmacia
ORDER BY ch.data_abertura DESC;

-- 11.6 Serviços da farmácia (cabeçalho + total de remédios)
SELECT s.id_servico, s.data_servico,
       fu.nome              AS funcionario,
       p.nome               AS paciente,
       SUM(sr.quantidade)   AS quantidade_remedios
FROM servico s
INNER JOIN funcionario     fu ON fu.id_funcionario = s.id_funcionario
INNER JOIN paciente        p  ON p.id_paciente     = s.id_paciente
INNER JOIN servico_remedio sr ON sr.id_servico     = s.id_servico
WHERE s.id_farmacia = :id_farmacia
GROUP BY s.id_servico
ORDER BY s.data_servico DESC;

-- 11.7 Itens de um serviço específico (detalhe)
SELECT r.nome, r.dosagem, sr.quantidade
FROM servico_remedio sr
INNER JOIN servico s ON s.id_servico = sr.id_servico
INNER JOIN remedio r ON r.id_remedio = sr.id_remedio
WHERE sr.id_servico = :id_servico
  AND s.id_farmacia = :id_farmacia;      -- impede ver serviço de outra farmácia

-- 11.8 Cadastrar funcionário na farmácia do gerente
-- (id_farmacia e id_gerente vêm da sessão, NUNCA do formulário)
INSERT INTO funcionario
    (nome, cpf, email, senha_hash, matricula, turno, cargo, telefone,
     id_farmacia, id_gerente_cadastro)
VALUES
    (:nome, :cpf, :email, :senha_hash, :matricula, :turno, :cargo, :telefone,
     :id_farmacia, :id_gerente);


-- =====================================================================
--  PARTE 12 — CONSULTAS: FUNCIONÁRIO  (só a farmácia dele)
-- =====================================================================

-- 12.1 Login / saudação: "Olá, Lucas — Farmácia Pedro João Neto"
SELECT fu.id_funcionario, fu.nome, fu.email, fu.senha_hash,
       f.id_farmacia, f.nome AS farmacia
FROM funcionario fu
INNER JOIN farmacia f ON f.id_farmacia = fu.id_farmacia
WHERE fu.email = :email;

-- 12.2 Gerentes da farmácia
SELECT g.nome, g.email, g.telefone, g.crf
FROM gerente g
INNER JOIN farmacia f ON f.id_farmacia = g.id_farmacia
WHERE f.id_farmacia = :id_farmacia;

-- 12.3 Remédios da farmácia  -> reutilize a consulta 11.4

-- 12.4 Remédios da farmácia filtrados por categoria (ex.: 'Dor de cabeça')
SELECT r.id_remedio, r.nome, r.dosagem, SUM(es.quantidade) AS disponivel
FROM remedio r
INNER JOIN remedio_categoria rc ON rc.id_remedio  = r.id_remedio
INNER JOIN categoria         c  ON c.id_categoria = rc.id_categoria
INNER JOIN estoque           es ON es.id_remedio  = r.id_remedio
WHERE c.nome = :categoria            -- ex.: 'Dor de cabeça'
  AND es.id_farmacia = :id_farmacia
GROUP BY r.id_remedio
ORDER BY r.nome;

-- 12.5 Chamado da farmácia  -> reutilize a consulta 11.5

-- 12.6 Abrir chamado
INSERT INTO chamado (titulo, descricao, prioridade, id_funcionario, id_farmacia)
VALUES (:titulo, :descricao, :prioridade, :id_funcionario, :id_farmacia);

-- 12.7 Criar serviço (cabeçalho + itens na mesma transação)
BEGIN TRANSACTION;

    INSERT INTO servico (id_funcionario, id_paciente, id_farmacia, observacao)
    VALUES (:id_funcionario, :id_paciente, :id_farmacia, :observacao);

    -- repita para cada remédio; last_insert_rowid() = id do serviço acima
    INSERT INTO servico_remedio (id_servico, id_remedio, quantidade)
    VALUES (last_insert_rowid(), :id_remedio, :quantidade);

COMMIT;
-- Obs.: com mais de um item, pegue o id do serviço no back-end
-- (result.lastInsertRowid) e use-o nos INSERTs seguintes, porque
-- last_insert_rowid() muda a cada INSERT.

-- 12.8 Serviços da farmácia  -> reutilize a consulta 11.6
