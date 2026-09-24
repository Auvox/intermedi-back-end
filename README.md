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
| `npm start` | Sobe o servidor sem reiniciar sozinho |
| `npm run db:reset` | **Apaga** o banco e recria tudo com os dados de teste |
| `npm run db:init` | Cria as tabelas que faltam (não apaga nada) |
| `npm run db:seed` | Coloca os dados de teste num banco vazio |
| `npm test` | Roda os testes num banco temporário (não mexe no seu) |

> Antes de rodar `db:reset`, pare o servidor (Ctrl+C) e feche o banco se ele
> estiver aberto no VS Code ou no DB Browser.

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
- **Erros:** respondem sempre `{ "error": "mensagem" }` com o status certo
  (400 dado inválido, 404 não encontrado, 409 duplicado/vinculado).

---

## Rotas

| Recurso | Rotas |
| --- | --- |
| Farmácia | `GET/POST /farmacia` · `GET/PUT/DELETE /farmacia/:id` |
| Gerente | `GET/POST /gerente` · `GET/PUT/DELETE /gerente/:id` |
| Funcionário | `GET/POST /funcionario` · `GET/PUT/DELETE /funcionario/:id` |
| Paciente | `GET/POST /paciente` · `GET/PUT/DELETE /paciente/:id` |
| Remédio | `GET/POST /remedios` · `GET/PUT/DELETE /remedios/:id` · filtro `GET /remedios?categoria=Febre` |
| Serviço | `POST /servicos` |
| App do paciente | `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/logout` · `GET/PUT/DELETE /api/pacientes/me` · `PUT /api/pacientes/:id/foto` |

### Campos obrigatórios novos

- **Gerente:** `fkIdFarmacia` (a farmácia dele). A matrícula é gerada pelo back.
- **Funcionário:** `fkIdFarmacia`. Pode mandar `senhaFuncionario`; se não
  mandar, a resposta traz uma `senhaProvisoria`. O turno aceita
  `manha`, `tarde`, `noite` ou `integral` ("Manhã" também funciona e vira `manha`).
- **Remédio:** pode mandar `idsCategoria: [1, 2]` para ligar às categorias.

---

## Variáveis de ambiente (opcional)

Copie `.env.example` para `.env` se quiser mudar a porta ou o caminho do banco.
O `.env` não vai para o Git.
