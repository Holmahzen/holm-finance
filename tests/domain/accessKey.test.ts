import { describe, it, expect } from "vitest";
import { accessKeyCheckDigit, formatAccessKey, formatCnpj, parseAccessKey } from "@/domain/accessKey";

// Chaves reais de notas ja importadas.
const VENDA = "35260949046940000100550040000231101485461920";
const COMPRA = "35260641631822000158550030000112431012300146";
const DEVOLUCAO_ML = "35260849046940000100550020001984331842368921";

describe("parseAccessKey", () => {
  it("le a chave de uma venda do Tiny", () => {
    expect(parseAccessKey(VENDA)).toMatchObject({
      ufName: "SP",
      year: 2026,
      month: 9,
      issuerDocument: "49046940000100",
      model: "55",
      modelName: "NF-e (mercadoria)",
      series: 4,
      number: 23110,
      valid: true,
    });
  });

  it("aceita a chave com espacos, como o leitor as vezes manda", () => {
    expect(parseAccessKey(formatAccessKey(COMPRA))).toMatchObject({
      issuerDocument: "41631822000158",
      series: 3,
      number: 11243,
      valid: true,
    });
  });

  it("confirma o digito verificador das notas reais", () => {
    for (const key of [VENDA, COMPRA, DEVOLUCAO_ML]) {
      expect(accessKeyCheckDigit(key.slice(0, 43))).toBe(Number(key[43]));
      expect(parseAccessKey(key)?.valid).toBe(true);
    }
  });

  it("reprova chave com digito trocado e recusa tamanho diferente de 44", () => {
    const trocada = VENDA.slice(0, 43) + (Number(VENDA[43]) === 9 ? "8" : "9");
    expect(parseAccessKey(trocada)?.valid).toBe(false);
    expect(parseAccessKey("123")).toBeNull();
    expect(parseAccessKey(VENDA + "0")).toBeNull();
  });

  it("reconhece o modelo do documento pela chave", () => {
    const cte = VENDA.slice(0, 20) + "57" + VENDA.slice(22);
    expect(parseAccessKey(cte)?.modelName).toBe("CT-e (transporte)");
    const nfce = VENDA.slice(0, 20) + "65" + VENDA.slice(22);
    expect(parseAccessKey(nfce)?.modelName).toBe("NFC-e (cupom ao consumidor)");
  });
});

describe("formatacao", () => {
  it("mostra a chave em blocos de 4 e o CNPJ com pontuacao", () => {
    expect(formatAccessKey(VENDA).slice(0, 14)).toBe("3526 0949 0469");
    expect(formatCnpj("49046940000100")).toBe("49.046.940/0001-00");
  });
});
