import * as serviceResumo from "../services/resumo.service.mjs";
import { enviarErro, enviarJson, erro, idDaUrl } from "../utils/http.mjs";
import { lerPeriodo } from "../utils/periodo.mjs";

// Todos aceitam ?periodo=7d|30d|90d|12m|tudo (padrão 30d) ou ?de=AAAA-MM-DD&ate=AAAA-MM-DD

// resumo do funcionario: dados, foto, serviços e chamados no período
export async function resumoFuncionario(req, res) {
  try {
    const id = idDaUrl(req, "Funcionario");
    const resumo = serviceResumo.funcionario(id, lerPeriodo(req));
    if (!resumo) throw erro(404, "Funcionario não encontrado");
    enviarJson(res, 200, { mensagem: "RESUMO DO FUNCIONARIO - GET", ...resumo });
  } catch (error) {
    enviarErro(res, error);
  }
}

// resumo do gerente: decisões, equipe, rede, estoque da farmácia
export async function resumoGerente(req, res) {
  try {
    const id = idDaUrl(req, "Gerente");
    const resumo = serviceResumo.gerente(id, lerPeriodo(req));
    if (!resumo) throw erro(404, "Gerente não encontrado");
    enviarJson(res, 200, { mensagem: "RESUMO DO GERENTE - GET", ...resumo });
  } catch (error) {
    enviarErro(res, error);
  }
}

// resumo da farmácia: equipe, estoque, serviços, chamados, rede
export async function resumoFarmacia(req, res) {
  try {
    const id = idDaUrl(req, "Farmácia");
    const resumo = serviceResumo.farmacia(id, lerPeriodo(req));
    if (!resumo) throw erro(404, "Farmácia não encontrada");
    enviarJson(res, 200, { mensagem: "RESUMO DA FARMÁCIA - GET", ...resumo });
  } catch (error) {
    enviarErro(res, error);
  }
}

// resumo do remédio: estoque na rede, saídas, chamados, redistribuições
export async function resumoRemedio(req, res) {
  try {
    const id = idDaUrl(req, "Remedio");
    const resumo = serviceResumo.remedio(id, lerPeriodo(req));
    if (!resumo) throw erro(404, "Remedio não encontrado");
    enviarJson(res, 200, { mensagem: "RESUMO DO REMEDIO - GET", ...resumo });
  } catch (error) {
    enviarErro(res, error);
  }
}

// resumo do paciente: atendimentos, remédios recebidos, farmácias
export async function resumoPaciente(req, res) {
  try {
    const id = idDaUrl(req, "Paciente");
    const resumo = serviceResumo.paciente(id, lerPeriodo(req));
    if (!resumo) throw erro(404, "Paciente não encontrado");
    enviarJson(res, 200, { mensagem: "RESUMO DO PACIENTE - GET", ...resumo });
  } catch (error) {
    enviarErro(res, error);
  }
}
