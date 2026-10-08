import { buscarRemediosNaFoto } from "../sistema-foto/busca-foto.service.mjs";

const caminho = process.argv[2];

if (!caminho) {
  console.error("Informe o caminho de uma imagem.");
  process.exitCode = 1;
} else {
  try {
    const resultado = await buscarRemediosNaFoto(caminho);

    console.log("Texto reconhecido:");
    console.log(resultado.textoReconhecido);

    console.log("\nMedicamentos encontrados:");

    if (resultado.medicamentos.length === 0) {
      console.log("Nenhum medicamento do catálogo corresponde ao texto.");
    } else {
      console.table(
        resultado.medicamentos.map((remedio) => ({
          id: remedio.idRemedio,
          nome: remedio.nomeRemedio,
          dosagem: remedio.dosagemRemedio,
        })),
      );
    }
  } catch (erro) {
    console.error("Falha na busca:", erro.message);
    process.exitCode = 1;
  }
}
