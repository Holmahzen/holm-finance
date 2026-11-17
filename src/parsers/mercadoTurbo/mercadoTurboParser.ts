import * as XLSX from "xlsx";
import { readWorkbook } from "@/parsers/excel/readWorkbook";
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
  /** "Custo (-)" — custo de produto que o Mercado Turbo já descontou dentro
   * de "Margem Contrib. (=)". Guardado à parte pra não ser descontado de
   * novo junto com o custo de produção cadastrado no Holm Finance. */
  marketplaceCost: number;
  customerName: string | null;
  status: string;
  /** "Código" — o código do anúncio (MLB...). É o único lugar que traz SKU e
   * código do anúncio juntos, por isso é a ponte pra cruzar com o gasto de
   * Ads (que só vem com o código, nunca com o SKU). */
  listingCode: string | null;
  /** "ID do Carrinho" — vendas do mesmo carrinho viajam no mesmo pacote. */
  cartId: string | null;
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
  const workbook = readWorkbook(buffer);
  const sheet = pickSheet(workbook);
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

  if (rawRows.length === 0) {
    throw new Error("A planilha não contém linhas de dados.");
  }

  // O Mercado Turbo já trocou a caixa de títulos sem aviso ("ID da venda" →
  // "ID da Venda", 17/11/2026). Normaliza pro nome canônico, ignorando
  // maiúsculas/minúsculas e espaços nas pontas, pra não quebrar a importação.
  const canonical = new Map<string, string>();
  for (const name of [
    ...REQUIRED_HEADERS,
    "Frete",
    "Qtd.",
    "Custo (-)",
    "Nome do Comprador",
    "Código",
    "ID do Carrinho",
  ]) {
    canonical.set(name.toLowerCase(), name);
  }
  const rows = rawRows.map((raw) => {
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(raw)) {
      const name = canonical.get(key.trim().toLowerCase()) ?? key;
      if (normalized[name] == null || normalized[name] === "") normalized[name] = value;
    }
    return normalized;
  });

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
      marketplaceCost: parseAmountCell(row["Custo (-)"]),
      customerName: cellString(row, "Nome do Comprador") || null,
      status: cellString(row, "Status Pedido"),
      listingCode: cellString(row, "Código") || null,
      cartId: cellString(row, "ID do Carrinho").replace(/^#/, "") || null,
    });
  }

  return { rows: parsed, skippedRows };
}
