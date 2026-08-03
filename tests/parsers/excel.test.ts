import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseExcel } from "@/parsers/excel/excelParser";
import { mapHeaders, detectFormat } from "@/parsers/excel/columnMapping";
import { parseAmountCell, parseDateCell } from "@/parsers/excel/amountAndDate";

function buildWorkbookBuffer(rows: Record<string, unknown>[]): Buffer {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Transacoes");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("parseAmountCell", () => {
  it("parses plain numbers", () => {
    expect(parseAmountCell(133.1)).toBe(133.1);
  });

  it("parses Brazilian formatted strings", () => {
    expect(parseAmountCell("R$ 1.234,56")).toBeCloseTo(1234.56);
  });

  it("returns 0 for null/empty", () => {
    expect(parseAmountCell(null)).toBe(0);
    expect(parseAmountCell("")).toBe(0);
  });
});

describe("parseDateCell", () => {
  it("parses Date objects", () => {
    const d = new Date(Date.UTC(2026, 6, 14));
    expect(parseDateCell(d)?.toISOString()).toBe(d.toISOString());
  });

  it("parses DD/MM/YYYY strings", () => {
    const d = parseDateCell("14/07/2026");
    expect(d?.getUTCFullYear()).toBe(2026);
    expect(d?.getUTCMonth()).toBe(6);
    expect(d?.getUTCDate()).toBe(14);
  });
});

describe("mapHeaders / detectFormat", () => {
  it("detects mercado_pago format from Entrada/Saída columns", () => {
    const mapping = mapHeaders([
      "Data",
      "Descrição",
      "ID Operação",
      "Entrada",
      "Saída",
      "Categoria",
      "Contraparte",
    ]);
    expect(detectFormat(mapping)).toBe("mercado_pago");
  });

  it("detects generic format from a single Valor column", () => {
    const mapping = mapHeaders(["Data", "Descrição", "Valor", "Tipo"]);
    expect(detectFormat(mapping)).toBe("generic");
  });

  it("returns null when required columns are missing", () => {
    const mapping = mapHeaders(["Foo", "Bar"]);
    expect(detectFormat(mapping)).toBeNull();
  });
});

describe("parseExcel", () => {
  it("parses a Mercado Pago style sheet with separate Entrada/Saída columns", () => {
    const buffer = buildWorkbookBuffer([
      {
        Data: "14/07/2026",
        Descrição: "Recebimento venda",
        "ID Operação": "OP001",
        Entrada: 250.5,
        Saída: null,
        Contraparte: "Cliente A",
      },
      {
        Data: "15/07/2026",
        Descrição: "Pagamento fornecedor",
        "ID Operação": "OP002",
        Entrada: null,
        Saída: 100,
        Contraparte: "Fornecedor B",
      },
    ]);

    const result = parseExcel(buffer);
    expect(result.format).toBe("mercado_pago");
    expect(result.transactions).toHaveLength(2);

    const [credit, debit] = result.transactions;
    expect(credit.trnType).toBe("CREDIT");
    expect(credit.amount).toBe("250.50");
    expect(credit.externalId).toBe("OP001");
    expect(credit.counterpartyName).toBe("Cliente A");

    expect(debit.trnType).toBe("DEBIT");
    expect(debit.amount).toBe("-100.00");
    expect(debit.externalId).toBe("OP002");
  });

  it("parses a generic sheet with a signed Valor + Tipo column", () => {
    const buffer = buildWorkbookBuffer([
      { Data: "01/06/2026", Descrição: "Venda", Valor: 500, Tipo: "Entrada" },
      { Data: "02/06/2026", Descrição: "Aluguel", Valor: 1200, Tipo: "Saída" },
    ]);

    const result = parseExcel(buffer);
    expect(result.format).toBe("generic");
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0]).toMatchObject({ trnType: "CREDIT", amount: "500.00" });
    expect(result.transactions[1]).toMatchObject({ trnType: "DEBIT", amount: "-1200.00" });
  });

  it("synthesizes a stable external id when no id column is present", () => {
    const rows = [{ Data: "01/06/2026", Descrição: "Venda", Valor: 500, Tipo: "Entrada" }];
    const a = parseExcel(buildWorkbookBuffer(rows));
    const b = parseExcel(buildWorkbookBuffer(rows));
    expect(a.transactions[0].externalId).toBe(b.transactions[0].externalId);
  });

  it("throws a clear error when the format cannot be detected", () => {
    const buffer = buildWorkbookBuffer([{ Foo: "bar", Baz: 1 }]);
    expect(() => parseExcel(buffer)).toThrow(/formato/i);
  });

  it("skips rows with no date or empty description", () => {
    const buffer = buildWorkbookBuffer([
      { Data: null, Descrição: "Sem data", Valor: 10, Tipo: "Entrada" },
      { Data: "01/06/2026", Descrição: "", Valor: 10, Tipo: "Entrada" },
      { Data: "01/06/2026", Descrição: "Válida", Valor: 10, Tipo: "Entrada" },
    ]);
    const result = parseExcel(buffer);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].memo).toBe("Válida");
  });
});
