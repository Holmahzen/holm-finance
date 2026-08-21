import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseShopeeWorkbook } from "@/parsers/shopee/shopeeParser";

const BASE_HEADERS = [
  "ID Venda",
  "ID do Item",
  "Título",
  "SKU",
  "Data",
  "Frete",
  "Valor Unit.",
  "Qtde.",
  "Faturamento SHP",
  "Custo (-)",
  "Imposto (-)",
  "Cupom (-)",
  "Comissão Afiliado (-)",
  "Tarifa de Venda (-)",
  "Ajustes da Shopee",
  "Rebate Shopee (+)",
  "Frete Comprador (-)",
  "Frete Vendedor (-)",
  "Frete Entrega Direta",
  "Margem Contrib. (=)",
  "MC (%)",
];

function buildWorkbookBuffer(rows: Record<string, unknown>[]): Buffer {
  const sheet = XLSX.utils.json_to_sheet(rows, { header: BASE_HEADERS });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "table-pedidos1");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    "ID Venda": "2608125US4A0B0",
    "ID do Item": 43881202587,
    Título: "Kit Com 2 Touca Tactel Lavável Cozinha Restaurante Padaria",
    SKU: "2.TOTAC1000",
    Data: "11/08/2026",
    Frete: "Full",
    "Valor Unit.": 19.9,
    "Qtde.": 1,
    "Faturamento SHP": 19.9,
    "Custo (-)": "",
    "Imposto (-)": "",
    "Cupom (-)": 0,
    "Comissão Afiliado (-)": 0,
    "Tarifa de Venda (-)": 8.47,
    "Ajustes da Shopee": 0,
    "Rebate Shopee (+)": 0,
    "Frete Comprador (-)": 0,
    "Frete Vendedor (-)": 0,
    "Frete Entrega Direta": 0,
    "Margem Contrib. (=)": 11.43,
    "MC (%)": 5744,
    ...overrides,
  };
}

describe("parseShopeeWorkbook", () => {
  it("maps a valid row to the expected sale fields", () => {
    const buffer = buildWorkbookBuffer([makeRow()]);
    const result = parseShopeeWorkbook(buffer);

    expect(result.skippedRows).toBe(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      orderId: "2608125US4A0B0",
      sku: "2.TOTAC1000",
      productName: "Kit Com 2 Touca Tactel Lavável Cozinha Restaurante Padaria",
      channel: "Shopee",
      shippingModality: "Full",
      quantity: 1,
      grossRevenue: 19.9,
      netRevenue: 11.43,
      marketplaceCost: 0,
      customerName: null,
      status: "Concluído",
    });
    expect(result.rows[0].saleDate.getUTCFullYear()).toBe(2026);
    expect(result.rows[0].saleDate.getUTCMonth()).toBe(7);
    expect(result.rows[0].saleDate.getUTCDate()).toBe(11);
  });

  it("strips a leading # from the order id, if present", () => {
    const buffer = buildWorkbookBuffer([makeRow({ "ID Venda": "#123" })]);
    const result = parseShopeeWorkbook(buffer);
    expect(result.rows[0].orderId).toBe("123");
  });

  it("skips rows missing order id, sku or date", () => {
    const buffer = buildWorkbookBuffer([
      makeRow({ "ID Venda": "" }),
      makeRow({ SKU: "" }),
      makeRow({ Data: "" }),
      makeRow(),
    ]);
    const result = parseShopeeWorkbook(buffer);
    expect(result.rows).toHaveLength(1);
    expect(result.skippedRows).toBe(3);
  });

  it("skips rows with a corrupted amount cell (erro interno da Shopee na exportação)", () => {
    const buffer = buildWorkbookBuffer([
      makeRow({
        "Faturamento SHP": "com.sun.faces.facelets.tag.ui.ComponentRef@533e33f1 10,65",
      }),
      makeRow(),
    ]);
    const result = parseShopeeWorkbook(buffer);
    expect(result.rows).toHaveLength(1);
    expect(result.skippedRows).toBe(1);
  });

  it("throws when required columns are missing", () => {
    const sheet = XLSX.utils.json_to_sheet([{ Foo: "bar" }]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "table-pedidos1");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

    expect(() => parseShopeeWorkbook(buffer)).toThrow(/colunas não encontradas/);
  });

  it("throws when the sheet has no rows", () => {
    const sheet = XLSX.utils.json_to_sheet([]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "table-pedidos1");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

    expect(() => parseShopeeWorkbook(buffer)).toThrow(/não contém linhas/);
  });
});
