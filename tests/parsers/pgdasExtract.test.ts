import { describe, it, expect } from "vitest";
import { parsePgdasExtractText } from "@/parsers/pgdas/pgdasExtractParser";

/** Texto como o pdf-parse devolve do extrato de 08/2026 da Holm (recortado). */
const EXTRATO = [
  "Extrato do Simples Nacional",
  "Gerado em 10/09/2026 20:57:20",
  "Apurado em 10/09/2026 20:55:40",
  "Apuração Original",
  "PGDAS-D 2018 Versão 2.2.30",
  "1) Informações do Contribuinte",
  "CNPJ Básico: 49.046.940 Nome Empresarial: REGIMAR SOUZA SILVA LTDA",
  "Data de Abertura: 03/01/2023 Regime de Apuração: Competência Optante pelo Simples Nacional: Sim",
  "2) Informações da Apuração 49046940202608001",
  "Período de Apuração (PA): 08/2026",
  "2.1 Discriminativo de Receitas",
  "Total de Receitas Brutas (R$) Mercado Interno Mercado Externo Total",
  "Receita Bruta do PA (RPA) - Competência 481.946,66 0,00 481.946,66",
  "Receita bruta acumulada nos doze meses anteriores ao PA",
  "(RBT12) 3.610.558,66 0,00 3.610.558,66",
  "Receita bruta acumulada nos doze meses anteriores ao PA",
  "proporcionalizada (RBT12p)",
  "Receita bruta acumulada no ano-calendário corrente (RBA) 3.002.712,30 0,00 3.002.712,30",
  "Receita bruta acumulada no ano-calendário anterior",
  "(RBAA) 2.021.634,46 0,00 2.021.634,46",
  "Limite de receita bruta proporcionalizado 4.800.000,00 4.800.000,00",
  "2.2) Receitas Brutas Anteriores (R$)",
  "2.2.1) Mercado Interno",
  "01/2025 164.839,31 02/2025 116.215,68 03/2025 118.835,82 04/2025 125.649,74",
  "05/2026 403.276,08 06/2026 381.394,76 07/2026 384.688,41",
  "2.2.2) Mercado Externo",
  "01/2025 0,00 02/2025 0,00",
  "3) Informações dos Estabelecimentos - valores referentes às Receitas Informadas",
  "CNPJ Estabelecimento: 49.046.940/0001-00",
  "Sublimite de Receita Anual (R$): 3.600.000,00 Impedido de recolher ICMS/ISS no DAS: Não",
  ".",
  "Valor do Débito por Tributo para a Atividade (R$):",
  "Revenda de mercadorias, exceto para o exterior - Sem substituição tributária/tributação",
  "monofásica/antecipação com encerramento de tributação",
  "Receita Bruta Informada: R$ 240.393,71",
  "IRPJ CSLL COFINS PIS/Pasep INSS/CPP ICMS IPI ISS Total",
  "2.768,48 2.050,73 5.797,41 1.257,10 8.633,57 9.568,87 0,00 0,00 30.076,16",
  "Parcela 1: R$ 240.393,71",
  "Valor do Débito por Tributo para a Atividade (R$):",
  "Venda de mercadorias industrializadas pelo contribuinte, exceto para o exterior - Sem substituição",
  "tributária/tributação monofásica/antecipação com encerramento de tributação",
  "Receita Bruta Informada: R$ 241.552,95",
  "IRPJ CSLL COFINS PIS/Pasep INSS/CPP ICMS IPI ISS Total",
  "2.065,21 1.822,24 5.092,56 1.103,06 5.709,69 9.532,22 8.503,80 0,00 33.828,78",
  "Informações por Estabelecimento",
  "Total do Débito Exigível (R$)",
  "IRPJ CSLL COFINS PIS/Pasep INSS/CPP ICMS IPI ISS Total",
  "1,00 1,00 1,00 1,00 1,00 1,00 1,00 0,00 7,00",
  "4) Total Geral da Empresa",
  "Total do Débito Declarado (exigível + suspenso) (R$)",
  "IRPJ CSLL COFINS PIS/Pasep INSS/CPP ICMS IPI ISS Total",
  "4.833,69 3.872,97 10.889,97 2.360,16 14.343,26 19.101,09 8.503,80 0,00 63.904,94",
  "Total do Débito Exigível (R$)",
  "IRPJ CSLL COFINS PIS/Pasep INSS/CPP ICMS IPI ISS Total",
  "4.833,69 3.872,97 10.889,97 2.360,16 14.343,26 19.101,09 8.503,80 0,00 63.904,94",
  "6) Informações sobre DAS Gerado na apuração: 49046940202608001",
  "Número: 07202625315063379 Data de Vencimento:",
  "21/09/2026 Data limite para acolhimento: 21/09/2026",
  "Principal 63.904,94 Multa 0,00 Juros 0,00 Total 63.904,94",
  "6.2) Informações da Arrecadação do DAS gerado nesta apuração",
  "Não foi reconhecido pagamento até a presente data",
].join("\n");

describe("parsePgdasExtractText", () => {
  const e = parsePgdasExtractText(EXTRATO);

  it("lê o cabeçalho e as receitas do mês, dos 12 meses e dos anos", () => {
    expect(e).toMatchObject({
      cnpjBase: "49046940",
      companyName: "REGIMAR SOUZA SILVA LTDA",
      period: "2026-08",
      apuracaoNumber: "49046940202608001",
      rectifying: false,
      revenue: 481946.66,
      rbt12: 3610558.66,
      rba: 3002712.3,
      rbaa: 2021634.46,
      ceiling: 4800000,
      sublimit: 3600000,
      icmsBlocked: false,
    });
  });

  it("lê o faturamento dos meses anteriores só do mercado interno", () => {
    expect(e.previousRevenues).toEqual([
      { month: "2025-01", revenue: 164839.31 },
      { month: "2025-02", revenue: 116215.68 },
      { month: "2025-03", revenue: 118835.82 },
      { month: "2025-04", revenue: 125649.74 },
      { month: "2026-05", revenue: 403276.08 },
      { month: "2026-06", revenue: 381394.76 },
      { month: "2026-07", revenue: 384688.41 },
    ]);
  });

  it("separa as atividades com a receita e os tributos de cada uma", () => {
    expect(e.activities).toHaveLength(2);
    expect(e.activities[0]).toMatchObject({ kind: "revenda", revenue: 240393.71 });
    expect(e.activities[0].taxes).toMatchObject({ icms: 9568.87, ipi: 0, total: 30076.16 });
    expect(e.activities[1]).toMatchObject({ kind: "industrializacao", revenue: 241552.95 });
    expect(e.activities[1].taxes).toMatchObject({ ipi: 8503.8, icms: 9532.22, total: 33828.78 });
    expect(e.activities[1].description).toContain("industrializadas pelo contribuinte");
  });

  it("pega o total da empresa, e não o do estabelecimento", () => {
    expect(e.taxes).toEqual({
      irpj: 4833.69,
      csll: 3872.97,
      cofins: 10889.97,
      pis: 2360.16,
      cpp: 14343.26,
      icms: 19101.09,
      ipi: 8503.8,
      iss: 0,
      total: 63904.94,
    });
  });

  it("lê o DAS gerado e diz que ainda não foi pago", () => {
    expect(e.das).toEqual({
      number: "07202625315063379",
      dueDate: new Date(Date.UTC(2026, 8, 21)),
      principal: 63904.94,
      fine: 0,
      interest: 0,
      total: 63904.94,
      paid: false,
    });
  });

  it("recusa PDF que não é extrato do Simples", () => {
    expect(() => parsePgdasExtractText("RECIBO DE ENTREGA DA APURAÇÃO NO PGDAS-D")).toThrow(
      "não é um extrato do Simples Nacional",
    );
  });
});
