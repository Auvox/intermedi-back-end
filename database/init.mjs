// =====================================================================
//  Preparo do banco em desenvolvimento
//
//  npm run db:init   -> cria as tabelas; se o banco for novo, põe os dados de teste
//  npm run db:seed   -> põe os dados de teste (banco precisa estar vazio)
//  npm run db:reset  -> APAGA o banco e recria tudo com os dados de teste
// =====================================================================
import {
  abrirBanco,
  apagarBanco,
  aplicarSchema,
  aplicarSeed,
  bancoExiste,
  bancoVazio,
  caminhoDoBanco,
} from "./setup.mjs";

const args = process.argv.slice(2);
const reset = args.includes("--reset");
const seed = args.includes("--seed");
const caminho = caminhoDoBanco();

try {
  if (reset) apagarBanco(caminho);

  const novo = !bancoExiste(caminho);
  const db = abrirBanco(caminho);
  aplicarSchema(db);

  if (seed || novo || reset) {
    if (!bancoVazio(db)) {
      throw new Error(
        "O banco já tem dados. Para recomeçar do zero use: npm run db:reset",
      );
    }
    aplicarSeed(db);
    console.log(`Banco pronto com dados de teste: ${caminho}`);
  } else {
    console.log(`Tabelas conferidas (dados mantidos): ${caminho}`);
  }

  db.close();
} catch (error) {
  console.error(`\nErro ao preparar o banco: ${error.message}\n`);
  process.exitCode = 1;
}
