import * as XLSX from "xlsx";
import { parseAmountCell, parseDateCell } from "@/parsers/excel/amountAndDate";

export type MercadoTurboSaleRow = {
  orderId: string;
  saleDate: Date;
  sku: string;
  productName: string;
  channel: string;
  shippingModality: string | null;
  quantity: number;
  grossRevenue: number;
  netRevenue: number;
  customerName: string | null;
  status: string;
};

export type MercadoTurboParseResult = {
  rows: MercadoTurboSaleRow[];
  skippedRows: number;
};

const REQUIRED_HEADERS = [
  "ID da venda",
  "SKU",
  "Anúncio",
  "Data",
  "Qtd.",
  "Faturamento ML",
  "Margem Contrib. (=)",
  "Status Pedido",
] as const;

function pickSheet(workbook: XLSX.WorkBook): XLSX.WorkSheet {
  const named = workbook.SheetNames.find((n) => /pedido/i.test(n));
  const sheetName = named ?? workbook.SheetNames[0];
  return workbook.Sheets[sheetName];
}

function cellString(row: Record<string, unknown>, header: string): string {
  const value = row[header];
  return value != null ? String(value).trim() : "";
}

export function parseMercadoTurboWorkbook(buffer: Buffer): MercadoTurboParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = pickSheet(workbook);
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

  if (rows.length === 0) {
    throw new Error("A planilha não contém linhas de dados.");
  }

  const headers = Object.keys(rows[0]);
  const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  if (missing.length > 0) {
    throw new Error(
      `Planilha em formato inesperado — colunas não encontradas: ${missing.join(", ")}.`,
    );
  }

  const parsed: MercadoTurboSaleRow[] = [];
  let skippedRows = 0;

  for (const row of rows) {
    const orderId = cellString(row, "ID da venda").replace(/^#/, "");
    const saleDate = parseDateCell(row["Data"]);
    const sku = cellString(row, "SKU");

    if (!orderId || !saleDate || !sku) {
      skippedRows += 1;
      continue;
    }

    parsed.push({
      orderId,
      saleDate,
      sku,
      productName: cellString(row, "Anúncio"),
      channel: "Mercado Livre",
      shippingModality: cellString(row, "Frete") || null,
      quantity: Math.round(parseAmountCell(row["Qtd."])),
      grossRevenue: parseAmountCell(row["Faturamento ML"]),
      netRevenue: parseAmountCell(row["Margem Contrib. (=)"]),
      customerName: cellString(row, "Nome do Comprador") || null,
      status: cellString(row, "Status Pedido"),
    });
  }

  return { rows: parsed, skippedRows };
}
