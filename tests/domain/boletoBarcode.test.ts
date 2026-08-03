import { describe, it, expect } from "vitest";
import {
  extractLinhaDigitavel,
  decodeLinhaDigitavel,
  decodeCodigoBarras,
  parseBoletoCode,
} from "@/domain/boletoBarcode";

function mod10(digits: string): number {
  let sum = 0;
  let weight = 2;
  for (let i = digits.length - 1; i >= 0; i--) {
    let product = Number(digits[i]) * weight;
    if (product > 9) product = Math.floor(product / 10) + (product % 10);
    sum += product;
    weight = weight === 2 ? 1 : 2;
  }
  const dv = 10 - (sum % 10);
  return dv === 10 ? 0 : dv;
}

function mod11(digits: string): number {
  let sum = 0;
  let weight = 2;
  for (let i = digits.length - 1; i >= 0; i--) {
    sum += Number(digits[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const resto = sum % 11;
  const dv = 11 - resto;
  return dv === 0 || dv === 10 || dv === 11 ? 1 : dv;
}

/** Monta uma linha digitável de 47 dígitos válida (checksums corretos) pra teste. */
function buildLinha({
  bankCode,
  freeField,
  fatorVencimento,
  amountCents,
}: {
  bankCode: string;
  freeField: string; // 25 dígitos
  fatorVencimento: number;
  amountCents: number;
}) {
  const campo1Base = bankCode + "9" + freeField.slice(0, 5);
  const campo1 = campo1Base + mod10(campo1Base);
  const campo2Base = freeField.slice(5, 15);
  const campo2 = campo2Base + mod10(campo2Base);
  const campo3Base = freeField.slice(15, 25);
  const campo3 = campo3Base + mod10(campo3Base);
  const campo4 = "1"; // DV geral do código de barras (não validado pelo parser)
  const campo5 = String(fatorVencimento).padStart(4, "0") + String(amountCents).padStart(10, "0");
  return campo1 + campo2 + campo3 + campo4 + campo5;
}

/** Monta um código de barras de 44 dígitos válido (DV geral mod11 correto) pra teste. */
function buildCodigoBarras({
  bankCode,
  freeField,
  fatorVencimento,
  amountCents,
}: {
  bankCode: string;
  freeField: string; // 25 dígitos
  fatorVencimento: number;
  amountCents: number;
}) {
  const semDv =
    bankCode +
    "9" +
    String(fatorVencimento).padStart(4, "0") +
    String(amountCents).padStart(10, "0") +
    freeField;
  const dv = mod11(bankCode + "9" + semDv.slice(4));
  return bankCode + "9" + String(dv) + semDv.slice(4);
}

describe("extractLinhaDigitavel", () => {
  it("finds a valid linha digitável embedded in noisy PDF-extracted text", () => {
    const linha = buildLinha({
      bankCode: "748",
      freeField: "1234567890123456789012345",
      fatorVencimento: 9200,
      amountCents: 150000,
    });
    const text = `Beneficiário: EMPRESA LTDA\nLinha digitável\n${linha}\nPague até o vencimento`;
    expect(extractLinhaDigitavel(text)).toBe(linha);
  });

  it("returns null when there is no valid linha digitável in the text", () => {
    expect(extractLinhaDigitavel("nada relevante aqui, so um cnpj 12345678000199")).toBeNull();
  });

  it("ignores dots/spaces commonly used to format the linha digitável", () => {
    const linha = buildLinha({
      bankCode: "341",
      freeField: "9876543210987654321098765",
      fatorVencimento: 9300,
      amountCents: 25099,
    });
    const formatted = `${linha.slice(0, 5)}.${linha.slice(5, 10)} ${linha.slice(10, 15)}.${linha.slice(15, 21)} ${linha.slice(21, 26)}.${linha.slice(26, 32)} ${linha[32]} ${linha.slice(33)}`;
    expect(extractLinhaDigitavel(formatted)).toBe(linha);
  });
});

describe("decodeLinhaDigitavel", () => {
  it("decodes bank code, amount and due date correctly", () => {
    const linha = buildLinha({
      bankCode: "237",
      freeField: "1111122222333334444455555",
      fatorVencimento: 9300,
      amountCents: 187650,
    });
    const parsed = decodeLinhaDigitavel(linha);
    expect(parsed.bankCode).toBe("237");
    expect(parsed.bankName).toBe("Bradesco");
    expect(parsed.amount).toBe("1876.50");
    expect(parsed.dueDate).not.toBeNull();
  });

  it("throws for a linha that isn't 47 digits", () => {
    expect(() => decodeLinhaDigitavel("123")).toThrow();
  });

  it("returns null due date when fator de vencimento is zero", () => {
    const linha = buildLinha({
      bankCode: "001",
      freeField: "1111122222333334444455555",
      fatorVencimento: 0,
      amountCents: 5000,
    });
    expect(decodeLinhaDigitavel(linha).dueDate).toBeNull();
  });

  it("marks the source as linha_digitavel", () => {
    const linha = buildLinha({
      bankCode: "001",
      freeField: "1111122222333334444455555",
      fatorVencimento: 9300,
      amountCents: 5000,
    });
    expect(decodeLinhaDigitavel(linha).source).toBe("linha_digitavel");
  });
});

describe("decodeCodigoBarras", () => {
  it("decodes bank code, amount and due date correctly", () => {
    const codigo = buildCodigoBarras({
      bankCode: "341",
      freeField: "1111122222333334444455555",
      fatorVencimento: 9300,
      amountCents: 310000,
    });
    const parsed = decodeCodigoBarras(codigo);
    expect(parsed.bankCode).toBe("341");
    expect(parsed.bankName).toBe("Itaú");
    expect(parsed.amount).toBe("3100.00");
    expect(parsed.dueDate).not.toBeNull();
    expect(parsed.source).toBe("codigo_barras");
    expect(parsed.linhaDigitavel).toBeNull();
  });

  it("throws for a code that isn't 44 digits", () => {
    expect(() => decodeCodigoBarras("123")).toThrow();
  });
});

describe("parseBoletoCode", () => {
  it("accepts a valid 47-digit linha digitável, ignoring dots/spaces", () => {
    const linha = buildLinha({
      bankCode: "748",
      freeField: "1234567890123456789012345",
      fatorVencimento: 9300,
      amountCents: 150000,
    });
    const formatted = `${linha.slice(0, 5)}.${linha.slice(5, 10)} ${linha.slice(10, 15)}.${linha.slice(15, 21)} ${linha.slice(21, 26)}.${linha.slice(26, 32)} ${linha[32]} ${linha.slice(33)}`;
    const parsed = parseBoletoCode(formatted);
    expect(parsed.bankName).toBe("Sicredi");
    expect(parsed.amount).toBe("1500.00");
    expect(parsed.source).toBe("linha_digitavel");
  });

  it("accepts a valid 44-digit código de barras", () => {
    const codigo = buildCodigoBarras({
      bankCode: "001",
      freeField: "1111122222333334444455555",
      fatorVencimento: 9300,
      amountCents: 5000,
    });
    const parsed = parseBoletoCode(codigo);
    expect(parsed.bankName).toBe("Banco do Brasil");
    expect(parsed.amount).toBe("50.00");
    expect(parsed.source).toBe("codigo_barras");
  });

  it("rejects a 47-digit linha with a wrong checksum digit", () => {
    const linha = buildLinha({
      bankCode: "748",
      freeField: "1234567890123456789012345",
      fatorVencimento: 9300,
      amountCents: 150000,
    });
    const corrupted = linha.slice(0, 9) + (linha[9] === "0" ? "1" : "0") + linha.slice(10);
    expect(() => parseBoletoCode(corrupted)).toThrow(/inválida/);
  });

  it("rejects a 44-digit código with a wrong DV geral", () => {
    const codigo = buildCodigoBarras({
      bankCode: "001",
      freeField: "1111122222333334444455555",
      fatorVencimento: 9300,
      amountCents: 5000,
    });
    const corrupted = codigo.slice(0, 4) + (codigo[4] === "0" ? "1" : "0") + codigo.slice(5);
    expect(() => parseBoletoCode(corrupted)).toThrow(/inválido/);
  });

  it("rejects input that isn't 44 or 47 digits", () => {
    expect(() => parseBoletoCode("12345")).toThrow(/47 números.*44 números/);
  });
});
