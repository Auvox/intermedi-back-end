# Intermedi — Back-end

API em Node puro (`node:http`) com banco SQLite (`node:sqlite`).

**Requisito:** Node.js **22.13 ou mais novo** (`node -v`).

---

## Primeira vez (depois de clonar)

```bash
npm install
npm run db:reset
npm run dev
```

O servidor sobe em `http://localhost:3000`.
Todos os usuários dos dados de teste têm a senha **`senha123`**.

---

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Sobe o servidor e reinicia sozinho quando um `.mjs` muda |
| `npm run dev:teste-3d` | Igual ao `dev`, mas no banco próprio da branch `teste/intermedi-3d` (`.env.teste-3d`) |
| `npm start` | Sobe o servidor sem reiniciar sozinho |
| `npm run db:reset` | **Apaga** o banco e recria tudo com os dados de teste |
| `npm run db:init` | Cria as tabelas que faltam (não apaga nada) |
| `npm run db:seed` | Coloca os dados de teste num banco vazio |
| `npm test` | Roda os testes num banco temporário (não mexe no seu) |
| `npm run admin:criar -- --nome "Nome" --email x@y.com --cpf 000.000.000-00` | Cria um admin com matrícula e senha provisória (manda o e-mail). Com `--id 1` completa um admin antigo |
| `npm run acesso:reenviar -- --matricula G000123` | Gera uma senha provisória nova e manda de novo o e-mail com a matrícula (a senha antiga e as sessões abertas deixam de valer). No banco da `teste/intermedi-3d`: `node --env-file-if-exists=.env --env-file=.env.teste-3d scripts/reenviar-acesso.mjs --matricula G000123` |

> Antes de rodar `db:reset`, pare o servidor (Ctrl+C) e feche o banco se ele
> estiver aberto no VS Code ou no DB Browser.

---

## Login da equipe (JWT)

Admin, gerente e funcionário entram com **CPF + matrícula + senha** em
`POST /auth/login`. A resposta traz um JWT (`token`) e a pessoa logada
(`usuario`: papel, id, farmácia). O front manda o token em
`Authorization: Bearer <token>` em todas as chamadas.

- **Cadastro:** o admin cadastra o gerente (`POST /gerente`) e o gerente cadastra
  o funcionário (`POST /funcionario`, sempre na farmácia dele). O back gera a
  matrícula (`G000123` gerente, `000123` funcionário, `A000123` admin) e uma
  senha provisória, e manda as duas por e-mail ("Intermedi x Auvox"). A senha
  não volta na resposta, só no e-mail; se o envio falhar, a resposta traz
  `senhaProvisoria` para quem cadastrou entregar pessoalmente.
- **Sessão:** cada login cria uma linha em `sessao_usuario` (o `jti` do token).
  `POST /auth/logout` encerra a sessão; trocar a senha derruba todas.
  `GET /auth/me` devolve quem está logado. Duração: `JWT_EXPIRA_HORAS` (8 h).
- **Permissões:** `services/acesso.service.mjs` diz quem pode chamar cada rota.
  Sem token: 401. Perfil ou farmácia errados: 403. O admin acessa tudo; gerente
  e funcionário só os dados da farmácia deles. Rota nova sem regra fica só para
  o admin. Continuam públicos: catálogo de remédios, categorias, lista de
  farmácias, fotos (`/uploads/...`) e o app do paciente (`/api/*`, login próprio).
- **Primeiro admin:** `npm run admin:criar` (ninguém cadastra o admin pela tela).
  No seed, o admin é CPF `999.999.999-99`, matrícula `A000001`, senha `senha123`;
  os gerentes são `G000001`...`G000005` e os funcionários `000001`...`000009`
  (veja os CPFs em `database/seed.sql`).
- **E-mail:** sem `SMTP_HOST` no `.env`, nada é enviado: o e-mail fica salvo como
  `.html` em `tmp/emails/` (com as imagens embutidas) e o caminho aparece no
  terminal. O e-mail de boas-vindas usa a cor da plataforma de quem foi
  cadastrado (`services/email/paleta.mjs`: admin preto, gerente verde,
  funcionário azul); marcas e ícones são desenhados em `services/email/imagens.mjs`
  e vão anexados (`cid:`), porque os clientes de e-mail não mostram SVG.
- **`.env`** (fora do Git): `JWT_SECRET` (obrigatório em produção, 32+ caracteres)
  e as variáveis `SMTP_*`. Veja `.env.example`.

---

## Como o banco funciona

```
database/
├── schema.sql      ← tabelas (vai para o Git)
├── seed.sql        ← dados de teste (vai para o Git)
├── consultas.sql   ← consultas de referência com INNER JOIN (vai para o Git)
├── setup.mjs       ← funções que aplicam schema/seed
├── init.mjs        ← comandos db:init / db:seed / db:reset
├── database.mjs    ← conexão usada pelos services
└── intermedi.db    ← o banco em si (NÃO vai para o Git)
```

- O **`intermedi.db` é só seu**: cada pessoa gera o dela com `npm run db:reset`.
  Por isso as requisições de teste não geram mais conflito no PR.
- Quando o servidor sobe, ele cria as tabelas que faltarem automaticamente.
- `IF NOT EXISTS` **não altera** tabela que já existe. Se alguém mudar o
  `schema.sql`, todo mundo precisa rodar `npm run db:reset` depois do `git pull`.
  (Se esquecer, o servidor avisa na hora de subir.)

---

## Rotina do dia a dia

### Dados compartilhados pela main

Na `main`, o banco local é `database/intermedi.main.db`. Nas outras branches,
é `database/intermedi.db`; ambos ficam fora do Git. Ao rodar `npm install`,
o hook de commit é instalado neste clone. Cada `git commit` feito localmente
na `main` exporta automaticamente os registros para `database/main-data.json`
e inclui esse arquivo no próprio commit. Em outras branches, o hook não mexe
nos dados compartilhados. Quem fizer `git pull` da `main` recebe o JSON e,
ao iniciar o servidor ou rodar `npm run db:init`, carrega os dados no banco local.

Antes do primeiro commit na `main`, rode `npm run db:init` e confirme que o
banco dessa branch contém os cadastros desejados. Se os dados estiverem apenas
no banco de outra branch, copie-os para o banco da `main` com o servidor parado.
O snapshot inclui os registros das tabelas, inclusive dados pessoais e hashes
de senha: revise o arquivo antes de enviar ao repositório remoto.

Dados locais que divergem do último snapshot não são sobrescritos ao iniciar.
Para substituí-los pelos dados recebidos, rode `npm run db:sync`; o comando
faz uma cópia de segurança do banco antes. Commits feitos pela interface do
GitHub ou com `--no-verify` não executam o hook local. Cada colaborador precisa
rodar `npm install` depois de receber esta alteração.

1. `git checkout development && git pull`
2. Mudou algo em `database/`? → `npm run db:reset`
3. `git checkout -b feature/nome-da-tarefa`
4. `npm run dev` e teste à vontade (Postman, front, etc.)
5. Banco bagunçado? → Ctrl+C, `npm run db:reset`, `npm run dev`
6. `npm test` antes de abrir o PR
7. `git add .` → `git commit` → `git push` → abrir PR para `development`

### Precisa mudar uma tabela?

1. Altere `database/schema.sql`
2. Se precisar, ajuste `database/seed.sql`
3. Ajuste o service que usa a tabela
4. `npm run db:reset` e `npm test`
5. No PR, avise: **"precisa rodar `npm run db:reset`"**

---

## Padrões do código

- **Banco:** tabelas e colunas em `snake_case` (`id_farmacia`, `senha_hash`).
- **API (JSON):** os campos continuam no formato que o front já usa
  (`nomeFarmacia`, `cpfFuncionario`...). Os services fazem a conversão com
  apelidos no `SELECT` (`f.nome AS nomeFarmacia`).
- **Senhas:** nunca são salvas nem devolvidas em texto. O banco guarda só o
  hash (`utils/senha.mjs`).
- **Endereço:** fica na tabela `endereco`. O front continua mandando
  `cepFarmacia`, `enderecoFarmacia`... e o service cuida do resto.
  Se não mandar UF/estado, usa `SP`.
- **Vínculos nos cadastros:** envie os dados pessoais e o endereço no mesmo
  JSON. O controller lê o corpo e chama o service, que grava `endereco`, pega
  o ID gerado e o salva no `id_endereco` da entidade, tudo na mesma transação.
  Se ocorrer erro, nenhuma das duas inserções permanece no banco. Endereço
  omitido é opcional; se preenchido, precisa de logradouro, número, bairro,
  cidade e CEP. Gerente e farmácia no painel também enviam a UF escolhida.
- **Farmácia do gerente/funcionário:** use o `idFarmacia` real de `GET /farmacia`
  no campo `fkIdFarmacia` do POST. O service aceita também `idFarmacia`, mas
  rejeita IDs inexistentes e valores diferentes quando ambos são enviados.
  O endereço da pessoa é próprio: não recebe o ID do endereço da farmácia.
  `idAdminCadastro` e `idGerenteCadastro`, quando informados, precisam existir.
- **Resposta do POST:** `recebido` contém o ID da entidade, `idEndereco` e,
  para gerente/funcionário, `fkIdFarmacia`. O front usa esses IDs ao atualizar
  a lista. A farmácia não possui senha nem `idGerente`; a associação está
  em `gerente.id_farmacia`.
- **Erros:** respondem sempre `{ "error": "mensagem" }` com o status certo
  (400 dado inválido, 404 não encontrado, 409 duplicado/vinculado).

---

## Rotas

| Recurso | Rotas |
| --- | --- |
| Login da equipe | `POST /auth/login` `{ cpf, matricula, senha }` · `GET /auth/me` · `POST /auth/logout` |
| Farmácia | `GET/POST /farmacia` · `GET/PUT/DELETE /farmacia/:id` |
| Gerente | `GET/POST /gerente` · `GET/PUT/DELETE /gerente/:id` |
| Funcionário | `GET/POST /funcionario` · `GET/PUT/DELETE /funcionario/:id` |
| Paciente | `GET/POST /paciente` · `GET/PUT/DELETE /paciente/:id` |
| Remédio | `GET/POST /remedios` · `GET/PUT/DELETE /remedios/:id` · filtro `GET /remedios?categoria=Febre` |
| Serviço | `POST /servicos` |
| Pedidos entre farmácias | `GET /gerente/:id/redistribuicoes` · `GET /redistribuicao/:id` · `PUT /redistribuicao/:id/responder` |
| Preparo do envio | `GET /funcionario/:id/preparos` (avisos da equipe) · `POST /redistribuicao/:id/preparar` `{ idFuncionario }` |
| App do paciente | `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/logout` · `GET/PUT/DELETE /api/pacientes/me` · `PUT /api/pacientes/:id/foto` |

### Campos obrigatórios novos

- **Gerente:** `fkIdFarmacia` (a farmácia dele). A matrícula é gerada pelo back.
  A resposta traz `matricula` e `email` (`{ status: "enviado" | "teste" | "falhou", para }`).
- **Funcionário:** quando o gerente cadastra, a farmácia é a dele (o
  `fkIdFarmacia` enviado é ignorado); o admin precisa mandar `fkIdFarmacia`.
  Pode mandar `senhaFuncionario`; se não mandar, uma senha provisória vai por
  e-mail junto com a matrícula. O turno aceita
  `manha`, `tarde`, `noite` ou `integral` ("Manhã" também funciona e vira `manha`).
- **Remédio:** pode mandar `idsCategoria: [1, 2]` para ligar às categorias.

---

### Preparo dos pedidos entre farmácias

O aceite do gerente fornecedor deixa o pedido `aprovada` (aguardando preparo) e avisa todos os
funcionários da farmácia. O primeiro que chamar `POST /redistribuicao/:id/preparar` assume
(`preparando`); os outros recebem **409** com `preparadoPor`. A garantia é o `UPDATE ... WHERE
status = 'aprovada'`: o SQLite faz uma escrita por vez, então dois cliques no mesmo instante não
assumem o mesmo pedido (há teste com 6 requisições simultâneas em `tests/preparo.test.mjs`).
O preparo leva `caixas × 5 s` (caixas de 50 un.); depois o pedido vira `enviada` sozinho.

Bancos criados antes desse status são atualizados ao subir o servidor: a tabela
`redistribuicao` é recriada com o status novo e **todos os registros são copiados**
(`migrarRedistribuicao` em `database/setup.mjs`), sem precisar de `db:reset`.

## Variáveis de ambiente (opcional)

Copie `.env.example` para `.env` se quiser mudar a porta ou o caminho do banco.
O `.env` não vai para o Git.
