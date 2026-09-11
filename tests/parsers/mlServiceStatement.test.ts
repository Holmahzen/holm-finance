import { describe, it, expect } from "vitest";
import { parseMlServiceStatementText } from "@/parsers/nfse/mlServiceStatementParser";

/** Texto como o pdf-parse devolve de um demonstrativo real (valores trocados). */
function statementText(overrides: { name?: string; cnpj?: string; value?: string; month?: string; link?: string } = {}) {
  return [
    "ATENÇÃO: É necessário utilizar Internet Explorer, para abrir este link acima ou copie e cole em seu navegador.",
    ` Valor Total da Nota (R$): ${overrides.value ?? "1.234,56"} MÊS REF: ${overrides.month ?? "08/2026"}`,
    "CLIQUE NO LINK ABAIXO PARA VISUALIZAR SUA NOTA FISCAL ELECTRÔNICA:",
    overrides.link ?? "https://nfe.osasco.sp.gov.br/EissnfeWebApp/Sistema/Prestador/VisualizarNFENew.aspx?Id=ABC123",
    `Razão Social/Nome: ${overrides.name ?? "EBAZAR.COM.BR.LTDA"}`,
    `CNPJ/CPF: ${overrides.cnpj ?? "03.007.331/0001-41"}`,
    "Inscrição Municipal: 115310",
    "Endereço: Av. das Nações Unidas 3003",
    "Municipio: Osasco",
    "UF: SP 3550308",
    "PRESTADOR DE SERVIÇO - EMPRESA DO GRUPO MERCADO LIVRE",
    "DEMONSTRATIVO DE NOTA FISCAL ELECTRÔNICA PERÍODO: 19.08.2026",
  ].join("\n");
}

describe("parseMlServiceStatementText", () => {
  it("lê prestador, CNPJ, valor, mês, data e link", () => {
    expect(parseMlServiceStatementText(statementText())).toEqual({
      providerName: "EBAZAR.COM.BR.LTDA",
      providerDocument: "03007331000141",
      providerCity: "Osasco",
      amount: 1234.56,
      referenceMonth: "2026-08",
      issuedOn: new Date(Date.UTC(2026, 7, 19)),
      link: "https://nfe.osasco.sp.gov.br/EissnfeWebApp/Sistema/Prestador/VisualizarNFENew.aspx?Id=ABC123",
    });
  });

  it("lê valor de milhares e centavos", () => {
    expect(parseMlServiceStatementText(statementText({ value: "56.340,32" })).amount).toBe(56340.32);
    expect(parseMlServiceStatementText(statementText({ value: "0,33" })).amount).toBe(0.33);
  });

  it("recusa PDF que não é demonstrativo do Mercado Livre", () => {
    expect(() => parseMlServiceStatementText("Boleto bancário qualquer")).toThrow("não é um demonstrativo");
  });
});
