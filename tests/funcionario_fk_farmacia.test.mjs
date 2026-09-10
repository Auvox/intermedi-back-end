import test from "node:test";
import assert from "node:assert/strict";

import db from "../database/database.mjs";
import * as serviceFuncionario from "../services/funcionario.service.mjs";

test("cadastrar funcionario deve persistir fkIdFarmacia quando o payload informar a farmácia de atuação", () => {
  const cpf = `111.${Math.floor(100000000 + Math.random() * 900000000)}.000`;
  const email = `teste_${Date.now()}_${Math.round(Math.random() * 1000)}@mail.com`;

  const farmaciaId = Number(
    db
      .prepare(
        `
          INSERT INTO tbFarmacia (nomeFarmacia, emailFarmacia, telFarmacia, cnesFarmacia)
          VALUES (?, ?, ?, ?)
        `,
      )
      .run(
        `Farmacia Teste ${Date.now()}`,
        email,
        "(11) 1111-2222",
        `CNES-${Date.now()}`,
      ).lastInsertRowid,
  );

  const funcionarioPayload = {
    nomeFuncionario: "Funcionario Teste",
    cpfFuncionario: cpf,
    emailFuncionario: email,
    telFuncionario: "(11) 99999-0000",
    cargoFuncionario: "Farmaceutico",
    turnoFuncionario: "Manhã",
    fkIdFarmacia: farmaciaId,
  };

  serviceFuncionario.cadastrar(funcionarioPayload);

  const funcionario = db
    .prepare(`SELECT fkIdFarmacia FROM tbFuncionario WHERE cpfFuncionario = ?`)
    .get(cpf);

  assert.equal(funcionario.fkIdFarmacia, farmaciaId);

  db.prepare(`DELETE FROM tbFuncionario WHERE cpfFuncionario = ?`).run(cpf);
  db.prepare(`DELETE FROM tbFarmacia WHERE idFarmacia = ?`).run(farmaciaId);
});
