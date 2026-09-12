import { describe, it, expect } from "vitest";
import { parseDanfseNacionalText } from "@/parsers/nfse/danfseNacionalParser";

/** Texto como o pdf-parse devolve do DANFSe v2.0 da J3 Envios (padrão nacional). */
const DANFSE = [
  "DANFSe v2.0",
  "Documento Auxiliar da NFS-e",
  "Município: Barueri",
  "Ambiente Gerador: Sistema Nacional NFS-e",
  "CHAVE DE ACESSO DA NFS-E",
  "113V.5767.6765.4475399-S",
  "NÚMERO DA NFS-E",
  "00120710",
  "COMPETÊNCIA DA NFS-E",
  "21/07/2026",
  "DATA/HORA DA EMISSÃO DA NFS-E",
  "21/07/2026 16:56:57",
  "PRESTADOR / FORNECEDOR",
  "CNPJ / CPF / NIF",
  "58.556.821/0002-70",
  "Inscrição Municipal",
  "4BK6217",
  "Nome / Nome Empresarial",
  "J3 Envios",
  "Município / UF",
  "Barueri / SP",
  "TOMADOR / ADQUIRENTE",
  "CNPJ / CPF / NIF",
  "49.046.940/0001-00",
  "Nome / Nome Empresarial",
  "Regimar Souza Silva Ltda",
  "Município / UF",
  "São Paulo / SP",
  "SERVIÇO PRESTADO",
  "Código de Tributação Nacional / Municipal",
  "26.01 / 260101220",
  "TRIBUTAÇÃO MUNICIPAL",
  "BC ISSQN",
  "R$ 4.572,48",
  "Alíquota Aplicada",
  "2,00 %",
  "Retenção do ISSQN",
  "Não Retido",
  "ISSQN Apurado",
  "R$ 91,45",
  "VALOR TOTAL DA NFS-E",
  "Valor do Serviço",
  "R$ 4.572,48",
  "Desconto Incondicionado",
  "R$ 0,00",
  "Total das Retenções (ISSQN / Federais)",
  "R$ 0,00",
  "Valor Líquido da NFS-e",
  "R$ 4.572,48",
].join("\n");

describe("parseDanfseNacionalText", () => {
  it("lê a nota do padrão nacional da J3", () => {
    expect(parseDanfseNacionalText(DANFSE)).toEqual({
      providerName: "J3 Envios",
      providerDocument: "58556821000270",
      providerCity: "Barueri",
      recipientDocument: "49046940000100",
      amount: 4572.48,
      netAmount: 4572.48,
      issAmount: 91.45,
      issRate: 2,
      issWithheld: 0,
      issuedOn: new Date(Date.UTC(2026, 6, 21)),
      referenceMonth: "2026-07",
      documentNumber: "00120710",
      verificationCode: "113V.5767.6765.4475399-S",
      serviceCode: "260101220",
      serviceItem: "26.01",
    });
  });

  it("marca o ISS como retido quando a nota diz que é", () => {
    const retido = DANFSE.replace("Retenção do ISSQN\nNão Retido", "Retenção do ISSQN\nRetido pelo tomador");
    expect(parseDanfseNacionalText(retido).issWithheld).toBe(91.45);
  });

  it("pega o CNPJ do prestador, e não o do tomador", () => {
    expect(parseDanfseNacionalText(DANFSE).providerDocument).not.toBe("49046940000100");
  });

  it("recusa PDF que não é DANFSe", () => {
    expect(() => parseDanfseNacionalText("Demonstrativo de Nota Fiscal do Mercado Livre")).toThrow(
      "não é um DANFSe do padrão nacional",
    );
  });
});
