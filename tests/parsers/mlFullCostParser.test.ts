import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseMlFullCostWorkbook } from "@/parsers/mercadoLivreFull/mlFullCostParser";

// As quatro abas do "Relatório de Tarifas Full" do Mercado Livre — três trazem
// SKU/anúncio direto na linha (coleta, armazenamento prolongado, retirada), a
// de armazenamento geral não discrimina por SKU. Os nomes reais são truncados
// pelo próprio Excel (ex.: "armazenamento prolonga" sem o "do" final).
const HEADERS_WITH_SKU = ["Nº NF-e", "Nº do custo", "Data do custo", "SKU", "Nº do anúncio", "Valor do custo", "Detalhe"];
const HEADERS_STORAGE = ["Nº NF-e", "Nº da tarifa", "Data da tarifa", "Valor da tarifa", "Detalhe"];

function sheetWithSkuRows(rows: { costNumber: string; date: Date; sku: string; listingCode: string; value: number; details?: string }[]) {
  const grid: unknown[][] = [
    ["Relatório de Tarifas Full"],
    [],
    HEADERS_WITH_SKU,
    ...rows.map((r) => [
      `NFE-${r.costNumber}`,
      r.costNumber,
      r.date,
      r.sku,
      r.listingCode,
      r.value,
      r.details ?? null,
    ]),
  ];
  return XLSX.utils.aoa_to_sheet(grid);
}

function storageSheet(rows: { costNumber: string; date: Date; value: number }[]) {
  const grid: unknown[][] = [
    ["Relatório de Tarifas Full"],
    [],
    HEADERS_STORAGE,
    ...rows.map((r) => [`NFE-${r.costNumber}`, r.costNumber, r.date, r.value, null]),
  ];
  return XLSX.utils.aoa_to_sheet(grid);
}

function buildWorkbook(sheets: Record<string, XLSX.WorkSheet>): Buffer {
  const workbook = XLSX.utils.book_new();
  for (const [name, sheet] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  }
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx", cellDates: true }) as Buffer;
}

describe("parseMlFullCostWorkbook", () => {
  it("reconhece as quatro abas e classifica o tipo de custo por nome de aba", () => {
    const buffer = buildWorkbook({
      "Tarifa de armazenamento": storageSheet([{ costNumber: "1", date: new Date("2026-09-05"), value: 12.5 }]),
      "Custo por serviço de coleta": sheetWithSkuRows([
        { costNumber: "2", date: new Date("2026-09-06"), sku: "A1", listingCode: "MLB123", value: 3.2 },
      ]),
      "Custo de armazenamento prolonga": sheetWithSkuRows([
        { costNumber: "3", date: new Date("2026-09-07"), sku: "A2", listingCode: "MLB456", value: 8.9 },
      ]),
      "Custo por retirada de estoque": sheetWithSkuRows([
        { costNumber: "4", date: new Date("2026-09-08"), sku: "A3", listingCode: "MLB789", value: 15.0 },
      ]),
    });

    const { rows, skippedRows } = parseMlFullCostWorkbook(buffer);

    expect(skippedRows).toBe(0);
    expect(rows).toHaveLength(4);

    const byNumber = Object.fromEntries(rows.map((r) => [r.costNumber.split(":")[1], r]));
    expect(byNumber["1"].type).toBe("ARMAZENAMENTO");
    expect(byNumber["1"].sku).toBeNull();
    expect(byNumber["1"].amount).toBeCloseTo(12.5);

    expect(byNumber["2"].type).toBe("COLETA");
    expect(byNumber["2"].sku).toBe("A1");
    expect(byNumber["2"].listingCode).toBe("MLB123");

    expect(byNumber["3"].type).toBe("ARMAZENAMENTO_PROLONGADO");
    expect(byNumber["3"].sku).toBe("A2");

    expect(byNumber["4"].type).toBe("RETIRADA");
    expect(byNumber["4"].sku).toBe("A3");
  });

  it("prefixa costNumber com o tipo pra nao colidir numeros repetidos entre abas diferentes", () => {
    const buffer = buildWorkbook({
      "Custo por serviço de coleta": sheetWithSkuRows([
        { costNumber: "100", date: new Date("2026-09-06"), sku: "A1", listingCode: "MLB1", value: 1 },
      ]),
      "Custo por retirada de estoque": sheetWithSkuRows([
        { costNumber: "100", date: new Date("2026-09-06"), sku: "A2", listingCode: "MLB2", value: 2 },
      ]),
    });

    const { rows } = parseMlFullCostWorkbook(buffer);
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.costNumber)).size).toBe(2);
  });

  it("ignora linha sem numero de custo ou sem data valida", () => {
    const grid: unknown[][] = [
      ["Relatório de Tarifas Full"],
      [],
      HEADERS_WITH_SKU,
      ["NFE-1", "1", new Date("2026-09-06"), "A1", "MLB1", 5, null],
      ["NFE-2", "", new Date("2026-09-06"), "A2", "MLB2", 5, null], // sem numero
      ["NFE-3", "3", null, "A3", "MLB3", 5, null], // sem data
    ];
    const sheet = XLSX.utils.aoa_to_sheet(grid);
    const buffer = buildWorkbook({ "Custo por serviço de coleta": sheet });

    const { rows, skippedRows } = parseMlFullCostWorkbook(buffer);
    expect(rows).toHaveLength(1);
    expect(skippedRows).toBe(2);
  });

  it("lanca erro quando nenhuma aba reconhecida esta presente", () => {
    const sheet = XLSX.utils.aoa_to_sheet([["nada a ver aqui"]]);
    const buffer = buildWorkbook({ "Aba qualquer": sheet });
    expect(() => parseMlFullCostWorkbook(buffer)).toThrow(/Relatório de Tarifas Full/);
  });

  it("lanca erro quando a aba e reconhecida mas nao tem nenhuma linha valida", () => {
    const grid: unknown[][] = [["Relatório de Tarifas Full"], [], HEADERS_WITH_SKU];
    const sheet = XLSX.utils.aoa_to_sheet(grid);
    const buffer = buildWorkbook({ "Custo por serviço de coleta": sheet });
    expect(() => parseMlFullCostWorkbook(buffer)).toThrow(/Nenhuma linha/);
  });
});
