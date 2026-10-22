import path from 'node:path';
import { abrirBanco, aplicarSchema, bancoExiste, caminhoDoBanco } from './setup.mjs';
import { atualizarFarmaciasPublicas } from './farmacias-publicas.mjs';

let db;
try {
  const caminho = caminhoDoBanco();
  if (!bancoExiste(caminho)) throw new Error('Prepare primeiro o banco com npm run db:init.');
  db = abrirBanco(caminho);
  const backup = path.resolve(path.dirname(caminho), `antes-farmacias-${Date.now()}.db`);
  db.prepare('VACUUM INTO ?').run(backup);
  aplicarSchema(db);
  atualizarFarmaciasPublicas(db);
  console.log('Sete farmácias conferidas. IDs, estoques e demais cadastros preservados.');
  console.log(`Backup anterior: ${backup}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  db?.close();
}
