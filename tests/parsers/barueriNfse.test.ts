import { describe, it, expect } from "vitest";
import { parseBarueriNfseText } from "@/parsers/nfse/barueriNfseParser";

/** Texto como o pdf-parse devolve da NFS-e da J3 Envios (a transportadora do Flex). */
const NFSE = [
  "NFS-e - Nota Fiscal de Serviço Eletrônica",
  "Prefeitura de Barueri",
  "Emitida em",
  "17/06/2026 08:38:51",
  "Competência",
  "17/06/2026 08:38:51",
  "Número",
  "00095351",
  "Cód. Verificação",
  "134S.3008.1431.6702999-T",
  "J3 Envios",
  "CNPJ: 58.556.821/0002-70 Inscrição Municipal:",
  "4BK6217",
  "ALAMEDA RIO NEGRO, 503 - - ALPHAVILLE CENTRO INDUSTRIAL E",
  "EMPRESARIAL/ALPHAVILLE. - CEP: 06454000",
  "Barueri \tSP",
  "Tomador dos Serviços",
  "CPF/CNPJ: 49.046.940/0001-00 \tInscrição Municipal: Não Informado",
  "REGIMAR SOUZA SILVA LTDA",
  "Rua Cachoeira Branca, 29 - - Parque São Rafael - CEP: 08320230",
  "São Paulo \tSP",
  "Discriminação dos Serviços",
  "NFE",
  "Código do Serviço",
  "260101220 / Serviços de coleta, remessa ou entrega de correspondências",
  "Subitem Lista de Serviços (Lei complementar 116/03)",
  "26.01 / Serviços de coleta, remessa ou entrega de correspondências.",
  "Natureza da Operação",
  "Tributação no município",
  "Valor dos serviços \tR$ 4.130,82",
  "(-) Descontos \tR$ 0,00 \t(-) Deduções \tR$ 0,00",
  "(-) Retenções Federais \tR$ 0,00 \t(-) Desconto Incondicionado R$ 0,00",
  "(-) ISS Retido na Fonte \tR$ 0,00 \t(=) Base de Cálculo \tR$ 4.130,82",
  "Valor Líquido \tR$ 4.130,82 (x) Alíquota \t2 %",
  "(=) Valor do ISS \tR$ 82,62",
].join("\n");

describe("parseBarueriNfseText", () => {
  it("lê a nota de frete da J3 inteira", () => {
    expect(parseBarueriNfseText(NFSE)).toEqual({
      providerName: "J3 Envios",
      providerDocument: "58556821000270",
      providerCity: "Barueri",
      recipientDocument: "49046940000100",
      amount: 4130.82,
      netAmount: 4130.82,
      issAmount: 82.62,
      issRate: 2,
      issWithheld: 0,
      issuedOn: new Date(Date.UTC(2026, 5, 17)),
      referenceMonth: "2026-06",
      documentNumber: "00095351",
      verificationCode: "134S.3008.1431.6702999-T",
      serviceCode: "260101220",
      serviceItem: "26.01",
    });
  });

  it("usa a competência, e não a emissão, para o mês da nota", () => {
    const virada = NFSE.replace("Competência\n17/06/2026", "Competência\n31/05/2026");
    const nota = parseBarueriNfseText(virada);
    expect(nota.referenceMonth).toBe("2026-05");
    expect(nota.issuedOn.toISOString().slice(0, 10)).toBe("2026-06-17");
  });

  it("recusa PDF que não é NFS-e de Barueri", () => {
    expect(() => parseBarueriNfseText("Demonstrativo de Nota Fiscal do Mercado Livre")).toThrow(
      "não é uma NFS-e da Prefeitura de Barueri",
    );
  });
});
