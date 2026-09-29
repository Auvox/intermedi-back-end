import { abrirBanco, aplicarSchema } from "./setup.mjs";
import { sincronizarAoIniciar } from "./shared-data.mjs";

// Conexão única usada por todo o back-end.
// Ao subir, garante que todas as tabelas existem (não apaga nada).
const db = abrirBanco();
aplicarSchema(db);
sincronizarAoIniciar(db);

// Executa várias operações como uma só: se uma falhar, desfaz todas.
// Usa SAVEPOINT, então pode ser chamada dentro de outra transação.
let contador = 0;
export function emTransacao(operacao) {
  const nome = `sp_${++contador}`;
  db.exec(`SAVEPOINT ${nome}`);
  try {
    const resultado = operacao();
    db.exec(`RELEASE ${nome}`);
    return resultado;
  } catch (error) {
    db.exec(`ROLLBACK TO ${nome}`);
    db.exec(`RELEASE ${nome}`);
    throw error;
  }
}

export default db;
