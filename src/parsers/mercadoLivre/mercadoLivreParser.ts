import * as XLSX from "xlsx";
import { parseAmountCell } from "@/parsers/excel/amountAndDate";
import { parseFullPtBrDate, parsePtBrDayMonth } from "@/parsers/mercadoLivre/ptBrDate";

export type MercadoLivreSaleRow = {
  orderId: string;
  saleDate: Date;
  sku: string;
  productName: string;
  shippingModality: string | null;
  quantity: number;
  /** O que o comprador pagou: produto + acréscimo de parcelamento + envio. */
  grossRevenue: number;
  /** Coluna "Total (BRL)": o líquido repassado pelo Mercado Livre, já sem as
   * tarifas de venda e de envio. */
  netTotal: number;
  customerName: string | null;
  status: string;
  /** Data em que o comprador recebeu o pacote. É o que determina quando o
   * dinheiro é liberado; vazia enquanto a venda não foi entregue. */
  deliveredAt: Date | null;
  /** "agosto 2026" — em qual fatura mensal as tarifas dessa venda caem. */
  billingMonth: string | null;
};

export type MercadoLivreParseResult = {
  rows: MercadoLivreSaleRow[];
  skippedRows: number;
};

const REQUIRED_HEADERS = [
  "N.º de venda",
  "Data da venda",
  "Estado",
  "Unidades",
  "Total (BRL)",
  "SKU",
  "Título do anúncio",
] as const;

/** O cabeçalho real não fica na primeira linha: o relatório abre com texto de
 * apresentação e uma faixa de agrupamento ("Vendas", "Envios", "Devoluções")
 * antes dele. Procuramos a linha que contém a coluna-chave em vez de fixar um
 * índice, que quebraria se o ML mexesse no texto de cima. */
const HEADER_SCAN_DEPTH = 20;

/** O relatório repete o rótulo em blocos diferentes: "Unidades" aparece em
 * Vendas e em Devoluções, "Forma de entrega"/"Data de entrega" aparecem em
 * Envios e em Devoluções. Ficamos sempre com a PRIMEIRA ocorrência, que é a do
 * bloco de vendas/envio original — a segunda é sobre a devolução. */
function buildHeaderIndex(headerRow: unknown[]): Map<string, number> {
  const index = new Map<string, number>();
  headerRow.forEach((cell, i) => {
    const name = String(cell ?? "").trim();
    if (name && !index.has(name)) index.set(name, i);
  });
  return index;
}

function pickSheet(workbook: XLSX.WorkBook): XLSX.WorkSheet {
  const named = workbook.SheetNames.find((n) => /vendas/i.test(n));
  return workbook.Sheets[named ?? workbook.SheetNames[0]];
}

type Reader = {
  text: (row: unknown[], header: string) => string;
  amount: (row: unknown[], header: string) => number;
  raw: (row: unknown[], header: string) => unknown;
};

function makeReader(index: Map<string, number>): Reader {
  const raw = (row: unknown[], header: string) => {
    const i = index.get(header);
    return i === undefined ? null : row[i];
  };
  return {
    raw,
    text: (row, header) => String(raw(row, header) ?? "").trim(),
    amount: (row, header) => parseAmountCell(raw(row, header)),
  };
}

/** Só as linhas com número em "Total (BRL)" carregam dinheiro, status e datas
 * de envio. Nos pacotes com mais de um produto o ML abre linhas extras que
 * repetem o número da venda e trazem apenas o item (SKU, título, unidades) —
 * elas completam a venda, não são vendas novas. */
function isMoneyRow(row: unknown[], read: Reader): boolean {
  return typeof read.raw(row, "Total (BRL)") === "number";
}

/**
 * Pacotes multiproduto entregues como um só ("Pacote de 3 produtos") fecham o
 * dinheiro e a data de entrega numa linha própria, sem SKU — os produtos vêm
 * em vendas separadas, cada uma com SKU e valor zerado. Descartar essas linhas
 * por falta de SKU jogaria fora receita real (mais de 10% do total num mês
 * típico), então elas entram com um SKU marcador: o dinheiro é verdadeiro, só
 * não dá pra atribuir a um produto. Nenhum produto usa esse código, então ele
 * aparece separado nos relatórios por SKU em vez de se misturar a um real.
 */
export const PACKAGE_SKU = "PACOTE-ML";

export function parseMercadoLivreWorkbook(buffer: Buffer): MercadoLivreParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = pickSheet(workbook);
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });

  const headerRowIndex = grid
    .slice(0, HEADER_SCAN_DEPTH)
    .findIndex((row) => row.some((cell) => String(cell ?? "").trim() === REQUIRED_HEADERS[0]));

  if (headerRowIndex === -1) {
    throw new Error(
      `Planilha em formato inesperado — coluna "${REQUIRED_HEADERS[0]}" não encontrada nas primeiras ${HEADER_SCAN_DEPTH} linhas.`,
    );
  }

  const index = buildHeaderIndex(grid[headerRowIndex]);
  const missing = REQUIRED_HEADERS.filter((h) => !index.has(h));
  if (missing.length > 0) {
    throw new Error(
      `Planilha em formato inesperado — colunas não encontradas: ${missing.join(", ")}.`,
    );
  }

  const read = makeReader(index);
  const dataRows = grid
    .slice(headerRowIndex + 1)
    .filter((row) => read.text(row, REQUIRED_HEADERS[0]) !== "");

  if (dataRows.length === 0) {
    throw new Error("A planilha não contém linhas de dados.");
  }

  const byOrder = new Map<string, unknown[][]>();
  for (const row of dataRows) {
    const orderId = read.text(row, "N.º de venda");
    const group = byOrder.get(orderId);
    if (group) group.push(row);
    else byOrder.set(orderId, [row]);
  }

  const parsed: MercadoLivreSaleRow[] = [];
  let skippedRows = 0;

  for (const [orderId, group] of byOrder) {
    // A linha de dinheiro manda em valores, status e datas. Quando ela não
    // existe (venda cancelada antes de gerar valores), a primeira linha do
    // grupo ainda serve pra status e data da venda.
    const moneyRow = group.find((row) => isMoneyRow(row, read)) ?? group[0];
    const itemRow = group.find((row) => read.text(row, "SKU") !== "") ?? moneyRow;

    const saleDate = parseFullPtBrDate(read.raw(moneyRow, "Data da venda"));
    const hasMoney = isMoneyRow(moneyRow, read);
    const sku = read.text(itemRow, "SKU") || (hasMoney ? PACKAGE_SKU : "");

    if (!orderId || !saleDate || !sku) {
      skippedRows += group.length;
      continue;
    }

    const deliveredAt = parsePtBrDayMonth(read.raw(moneyRow, "Data de entrega"), saleDate);

    // "Total (BRL)" já é o líquido: o ML abate as tarifas de venda e de envio
    // antes de fechar a coluna. Bruto é o que o comprador pagou (produto +
    // envio + acréscimo de parcelamento), pra que a diferença entre os dois
    // seja exatamente o custo do marketplace.
    const grossRevenue =
      read.amount(moneyRow, "Receita por produtos (BRL)") +
      read.amount(moneyRow, "Receita por acréscimo no preço (pago pelo comprador)") +
      read.amount(moneyRow, "Receita por envio (BRL)");

    // Unidades some da linha de dinheiro nos pacotes multiproduto — some as
    // linhas de item, que é onde a quantidade de cada produto aparece.
    const quantity = group.reduce((sum, row) => sum + read.amount(row, "Unidades"), 0);

    parsed.push({
      orderId,
      saleDate,
      sku,
      productName:
        read.text(itemRow, "Título do anúncio") ||
        (sku === PACKAGE_SKU ? read.text(moneyRow, "Estado") : ""),
      shippingModality: read.text(moneyRow, "Forma de entrega") || null,
      quantity: Math.max(1, Math.round(quantity)),
      grossRevenue,
      netTotal: read.amount(moneyRow, "Total (BRL)"),
      customerName: read.text(moneyRow, "Comprador") || null,
      status: read.text(moneyRow, "Estado"),
      deliveredAt,
      billingMonth: read.text(moneyRow, "Mês de faturamento das suas tarifas") || null,
    });
  }

  return { rows: parsed, skippedRows };
}
