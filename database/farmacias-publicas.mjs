import { readFileSync } from "node:fs";

export const farmaciasPublicas = JSON.parse(readFileSync(new URL('./farmacias-publicas.json', import.meta.url), 'utf8'));

// Atualiza apenas cadastros reconhecidos por CNES ou pelos dados exatos do seed antigo.
// Os IDs das farmácias, estoques e vínculos existentes são preservados.
export function atualizarFarmaciasPublicas(db) {
  db.exec('SAVEPOINT farmacias_publicas');
  try {
    for (const f of farmaciasPublicas) {
      let atual = db.prepare('SELECT * FROM farmacia WHERE cnes = ?').get(f.cnes);
      if (!atual && f.substituiExemplo) {
        atual = db.prepare('SELECT * FROM farmacia WHERE nome = ? AND cnes = ?')
          .get(f.substituiExemplo.nome, f.substituiExemplo.cnes);
      }
      const campos = ['logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'cep', 'latitude', 'longitude'];
      const endereco = atual?.id_endereco
        ? db.prepare('SELECT * FROM endereco WHERE id_endereco = ?').get(atual.id_endereco) : null;
      // Um novo endereço evita alterar endereços compartilhados por outras pessoas.
      const idEndereco = endereco && campos.every(c => endereco[c] === f[c])
        ? atual.id_endereco
        : Number(db.prepare('INSERT INTO endereco (logradouro, numero, complemento, bairro, cidade, uf, cep, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(...campos.map(c => f[c])).lastInsertRowid);
      if (atual) {
        db.prepare('UPDATE farmacia SET nome = ?, cnes = ?, telefone = ?, id_endereco = ?, latitude = ?, longitude = ? WHERE id_farmacia = ?')
          .run(f.nome, f.cnes, f.telefone, idEndereco, f.latitude, f.longitude, atual.id_farmacia);
      } else {
        db.prepare('INSERT INTO farmacia (nome, cnes, telefone, id_endereco, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?)')
          .run(f.nome, f.cnes, f.telefone, idEndereco, f.latitude, f.longitude);
      }
    }
    if (db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('Referências inválidas no banco; atualização cancelada.');
    db.exec('RELEASE farmacias_publicas');
  } catch (error) {
    db.exec('ROLLBACK TO farmacias_publicas');
    db.exec('RELEASE farmacias_publicas');
    throw error;
  }
}
