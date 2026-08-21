import * as XLSX from "xlsx";
import { parseAmountCell, parseDateCell } from "@/parsers/excel/amountAndDate";

export type ShopeeSaleRow = {
  orderId: string;
  saleDate: Date;
  sku: string;
  productName: string;
  channel: string;
  shippingModality: string | null;
  quantity: number;
  grossRevenue: number;
  netRevenue: number;
  /** Shopee não expõe um "custo do produto" próprio embutido na receita
   * líquida (diferente do Mercado Turbo) — sempre 0 aqui. */
  marketplaceCost: number;
  customerName: string | null;
  status: string;
};

export type ShopeeParseResult = {
  rows: ShopeeSaleRow[];
  skippedRows: number;
};

// A planilha da Shopee não traz status do pedido nem nome do comprador —
// diferente do relatório do Mercado Turbo. Como esse relatório só lista
// pedidos com venda realizada, todo pedido reconhecido entra como "Concluído".
const DEFAULT_STATUS = "Concluído";

const REQUIRED_HEADERS = [
  "ID Venda",
  "SKU",
  "Título",
  "Data",
  "Qtde.",
  "Faturamento SHP",
  "Margem Contrib. (=)",
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

// A exportação da Shopee às vezes grava um erro interno do sistema deles
// (algo como "com.sun.faces.facelets...ComponentRef@...") no lugar do valor
// numérico de uma célula, quando a geração do relatório falha pra aquela
// linha. Isso não é um número válido de jeito nenhum — melhor pular a linha
// (contando como "pulada") do que tentar extrair um valor sem sentido dele.
function isPlausibleAmount(value: unknown): boolean {
  if (typeof value === "number") return true;
  if (value == null) return true;
  const text = String(value).trim();
  if (text === "") return true;
  return /^-?[\d.,]+$/.test(text);
}

export function parseShopeeWorkbook(buffer: Buffer): ShopeeParseResult {
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

  const parsed: ShopeeSaleRow[] = [];
  let skippedRows = 0;

  for (const row of rows) {
    const orderId = cellString(row, "ID Venda").replace(/^#/, "");
    const saleDate = parseDateCell(row["Data"]);
    const sku = cellString(row, "SKU");

    if (!orderId || !saleDate || !sku) {
      skippedRows += 1;
      continue;
    }

    if (
      !isPlausibleAmount(row["Qtde."]) ||
      !isPlausibleAmount(row["Faturamento SHP"]) ||
      !isPlausibleAmount(row["Margem Contrib. (=)"])
    ) {
      skippedRows += 1;
      continue;
    }

    parsed.push({
      orderId,
      saleDate,
      sku,
      productName: cellString(row, "Título"),
      channel: "Shopee",
      shippingModality: cellString(row, "Frete") || null,
      quantity: Math.round(parseAmountCell(row["Qtde."])),
      grossRevenue: parseAmountCell(row["Faturamento SHP"]),
      netRevenue: parseAmountCell(row["Margem Contrib. (=)"]),
      marketplaceCost: 0,
      customerName: null,
      status: DEFAULT_STATUS,
    });
  }

  return { rows: parsed, skippedRows };
}
