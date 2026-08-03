import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseOfx } from "@/parsers/ofx/ofxParser";
import { parseMemo } from "@/parsers/ofx/memoPatterns";
import { parseOfxDate } from "@/parsers/ofx/dateParser";
import { sgmlToXml } from "@/parsers/ofx/sgmlToXml";

const SYNTHETIC_PATH = path.resolve(
  __dirname,
  "../fixtures/ofx/synthetic/sample.ofx",
);

const REAL_DIR = path.resolve(__dirname, "../fixtures/ofx/real");
const REAL_FILE_1 = path.join(REAL_DIR, "14-a-15-sicredi.ofx");
const REAL_FILE_2 = path.join(REAL_DIR, "16-a-19-julho.ofx");
const hasRealFixtures = fs.existsSync(REAL_FILE_1) && fs.existsSync(REAL_FILE_2);

describe("parseOfxDate", () => {
  it("parses a date with Brazil GMT offset into the correct UTC instant", () => {
    const date = parseOfxDate("20260714000000[-3:GMT]");
    expect(date.toISOString()).toBe("2026-07-14T03:00:00.000Z");
  });
});

describe("sgmlToXml", () => {
  it("auto-closes unclosed leaf tags", () => {
    const xml = sgmlToXml("<TRNTYPE>DEBIT\n<FITID>123\n</STMTTRN>");
    expect(xml).toContain("<TRNTYPE>DEBIT</TRNTYPE>");
    expect(xml).toContain("<FITID>123</FITID>");
    expect(xml).toContain("</STMTTRN>");
  });

  it("leaves already well-formed lines untouched", () => {
    const xml = sgmlToXml("<TRNTYPE>DEBIT</TRNTYPE>");
    expect(xml).toBe("<TRNTYPE>DEBIT</TRNTYPE>");
  });
});

describe("parseMemo", () => {
  it("extracts PIX debit document and name", () => {
    const result = parseMemo(
      "PAGAMENTO PIX-PIX_DEB   07714104000107 GIGA MAIS FIBRA",
    );
    expect(result).toEqual({
      kind: "PIX_DEBIT",
      document: "07714104000107",
      name: "GIGA MAIS FIBRA",
    });
  });

  it("extracts PIX credit document and name", () => {
    const result = parseMemo(
      "RECEBIMENTO PIX-PIX_CRED  49046940000100 REGIMAR SOUZA SILVA LTDA",
    );
    expect(result).toEqual({
      kind: "PIX_CREDIT",
      document: "49046940000100",
      name: "REGIMAR SOUZA SILVA LTDA",
    });
  });

  it("extracts card purchase merchant and city", () => {
    const result = parseMemo(
      "COMPRAS NACIONAIS-VE0310492 LrvMercadinho            SAO PAULO    BR",
    );
    expect(result).toEqual({
      kind: "CARD_PURCHASE",
      name: "LrvMercadinho",
      city: "SAO PAULO",
    });
  });

  it("falls back to OTHER for unrecognized memo text", () => {
    expect(parseMemo("TARIFA MANUTENCAO CONTA")).toEqual({ kind: "OTHER" });
  });

  it("extracts name and CNPJ from the Sicredi 'Transferência recebida pelo Pix' format", () => {
    const result = parseMemo(
      "Transferência recebida pelo Pix - Regimar Souza Silva Ltda - 49.046.940/0001-00 - COOP SICREDI VALE DO PIQUIRI Agência: 726 Conta: 38562-4",
    );
    expect(result).toEqual({
      kind: "PIX_CREDIT",
      document: "49046940000100",
      name: "Regimar Souza Silva Ltda",
    });
  });

  it("extracts name from the Sicredi 'Transferência enviada pelo Pix' format, with a masked CPF", () => {
    const result = parseMemo(
      "Transferência enviada pelo Pix - MAX HERNANNI ALMEIDA SILVA - •••.370.828-•• - ITAÚ UNIBANCO S.A. (0341) Agência: 7910 Conta: 19027-6",
    );
    expect(result.kind).toBe("PIX_DEBIT");
    expect(result.kind !== "OTHER" && result.kind !== "CARD_PURCHASE" && result.name).toBe(
      "MAX HERNANNI ALMEIDA SILVA",
    );
    // CPF mascarado vira um fragmento parcial — nunca deve bater com um
    // documento completo cadastrado, então o vínculo automático fica seguro.
    expect(result.kind !== "OTHER" && result.kind !== "CARD_PURCHASE" && result.document).toBe(
      "370828",
    );
  });

  it("extracts name from the Sicredi 'Transferência Recebida' variant without 'pelo Pix'", () => {
    const result = parseMemo(
      "Transferência Recebida - Emilly Victoria Araújo da Silva - •••.271.758-•• - NU PAGAMENTOS - IP (0260) Agência: 1 Conta: 60393490-4",
    );
    expect(result.kind).toBe("PIX_CREDIT");
    expect(result.kind !== "OTHER" && result.kind !== "CARD_PURCHASE" && result.name).toBe(
      "Emilly Victoria Araújo da Silva",
    );
  });

  it("recognizes a Mercado Pago settlement transfer via the Sicredi format", () => {
    const result = parseMemo(
      "Transferência recebida pelo Pix - REGIMAR SOUZA SILVA LTDA - 49.046.940/0001-00 - MERCADO PAGO IP LTDA. (0323) Agência: 1 Conta: 1661969967-8",
    );
    expect(result).toEqual({
      kind: "PIX_CREDIT",
      document: "49046940000100",
      name: "REGIMAR SOUZA SILVA LTDA",
    });
  });
});

describe("parseOfx (synthetic fixture)", () => {
  it("parses account info, transactions and ledger balance", () => {
    const buffer = fs.readFileSync(SYNTHETIC_PATH);
    const statement = parseOfx(buffer);

    expect(statement.bankId).toBe("001");
    expect(statement.acctId).toBe("1234567890");
    expect(statement.currency).toBe("BRL");
    expect(statement.transactions).toHaveLength(3);
    expect(statement.ledgerBalance).toBe("750.00");

    const pixDebit = statement.transactions.find((t) => t.fitId === "1002");
    expect(pixDebit?.amount).toBe("-200.00");
    expect(pixDebit?.trnType).toBe("DEBIT");
  });
});

describe.skipIf(!hasRealFixtures)("parseOfx (real Sicredi fixtures)", () => {
  it("parses the 14-15 July statement with the exact known balance", () => {
    const buffer = fs.readFileSync(REAL_FILE_1);
    const statement = parseOfx(buffer);

    expect(statement.transactions).toHaveLength(19);
    expect(statement.ledgerBalance).toBe("79609.45");
    expect(statement.ledgerBalanceDate.toISOString().slice(0, 10)).toBe("2026-07-15");

    const gigaMaisFibra = statement.transactions.find((t) => t.fitId === "22821974775");
    expect(gigaMaisFibra?.amount).toBe("-133.10");
    const parsedMemo = parseMemo(gigaMaisFibra!.memo);
    expect(parsedMemo).toEqual({
      kind: "PIX_DEBIT",
      document: "07714104000107",
      name: "GIGA MAIS FIBRA",
    });
  });

  it("parses the 16-19 July statement and reconciles the balance delta", () => {
    const buffer1 = fs.readFileSync(REAL_FILE_1);
    const buffer2 = fs.readFileSync(REAL_FILE_2);
    const statement1 = parseOfx(buffer1);
    const statement2 = parseOfx(buffer2);

    expect(statement2.transactions).toHaveLength(32);
    expect(statement2.ledgerBalance).toBe("64083.27");

    const sum = statement2.transactions.reduce((acc, t) => acc + Number(t.amount), 0);
    const balanceDelta = Number(statement2.ledgerBalance) - Number(statement1.ledgerBalance);
    expect(Math.round(sum * 100)).toBe(Math.round(balanceDelta * 100));
  });

  it("dedupes identical FITIDs across a re-parse (parser is deterministic)", () => {
    const buffer = fs.readFileSync(REAL_FILE_1);
    const first = parseOfx(buffer).transactions.map((t) => t.fitId);
    const second = parseOfx(buffer).transactions.map((t) => t.fitId);
    expect(first).toEqual(second);
    expect(new Set(first).size).toBe(first.length);
  });
});
