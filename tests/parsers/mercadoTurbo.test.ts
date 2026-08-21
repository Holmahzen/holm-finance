import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseMercadoTurboWorkbook } from "@/parsers/mercadoTurbo/mercadoTurboParser";

const BASE_HEADERS = [
  "ID da venda",
  "ID do Carrinho",
  "Nome do Comprador",
  "Estado Frete",
  "Código",
  "Anúncio",
  "Conta",
  "Modalidade",
  "Ads",
  "SKU",
  "Data",
  "Frete",
  "Valor Unit.",
  "Qtd.",
  "Faturamento ML",
  "Custo (-)",
  "Imposto (-)",
  "Tarifa de Venda (-)",
  "Frete Comprador (-)",
  "Frete Vendedor (-)",
  "Margem Contrib. (=)",
  "MC em %",
  "Status Pedido",
  "Pagamentos",
  "Id Frete",
];

function buildWorkbookBuffer(rows: Record<string, unknown>[]): Buffer {
  const sheet = XLSX.utils.json_to_sheet(rows, { header: BASE_HEADERS });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "table-pedidos1");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    "ID da venda": "#2000017286284120",
    "ID do Carrinho": "",
    "Nome do Comprador": "Denis",
    "Estado Frete": "São Paulo",
    Código: "MLB5984720266",
    Anúncio: "Kit 5 Toucas Rede Preta",
    Conta: "HOLM.STORE",
    Modalidade: "Clássico",
    Ads: "",
    SKU: "5.TO1001",
    Data: "06/07/2026",
    Frete: "Flex",
    "Valor Unit.": 36.65,
    "Qtd.": 1,
    "Faturamento ML": 47.65,
    "Custo (-)": 10.75,
    "Imposto (-)": 5.13,
    "Tarifa de Venda (-)": 11.78,
    "Frete Comprador (-)": 11,
    "Frete Vendedor (-)": 0,
    "Margem Contrib. (=)": 8.99,
    "MC em %": "24.53%",
    "Status Pedido": "Pago",
    Pagamentos: 167575081300,
    "Id Frete": 47463368658,
    ...overrides,
  };
}

describe("parseMercadoTurboWorkbook", () => {
  it("maps a valid row to the expected sale fields", () => {
    const buffer = buildWorkbookBuffer([makeRow()]);
    const result = parseMercadoTurboWorkbook(buffer);

    expect(result.skippedRows).toBe(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      orderId: "2000017286284120",
      sku: "5.TO1001",
      productName: "Kit 5 Toucas Rede Preta",
      channel: "Mercado Livre",
      shippingModality: "Flex",
      quantity: 1,
      grossRevenue: 47.65,
      netRevenue: 8.99,
      marketplaceCost: 10.75,
      customerName: "Denis",
      status: "Pago",
    });
    expect(result.rows[0].saleDate.getUTCFullYear()).toBe(2026);
    expect(result.rows[0].saleDate.getUTCMonth()).toBe(6);
    expect(result.rows[0].saleDate.getUTCDate()).toBe(6);
  });

  it("strips the leading # from the order id", () => {
    const buffer = buildWorkbookBuffer([makeRow({ "ID da venda": "#123" })]);
    const result = parseMercadoTurboWorkbook(buffer);
    expect(result.rows[0].orderId).toBe("123");
  });

  it("skips rows missing order id, sku or date", () => {
    const buffer = buildWorkbookBuffer([
      makeRow({ "ID da venda": "" }),
      makeRow({ SKU: "" }),
      makeRow({ Data: "" }),
      makeRow(),
    ]);
    const result = parseMercadoTurboWorkbook(buffer);
    expect(result.rows).toHaveLength(1);
    expect(result.skippedRows).toBe(3);
  });

  it("throws when required columns are missing", () => {
    const sheet = XLSX.utils.json_to_sheet([{ Foo: "bar" }]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "table-pedidos1");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

    expect(() => parseMercadoTurboWorkbook(buffer)).toThrow(/colunas não encontradas/);
  });

  it("throws when the sheet has no rows", () => {
    const sheet = XLSX.utils.json_to_sheet([]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "table-pedidos1");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

    expect(() => parseMercadoTurboWorkbook(buffer)).toThrow(/não contém linhas/);
  });
});
