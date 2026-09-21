import * as XLSX from "xlsx";
import { parseAmountCell } from "@/parsers/excel/amountAndDate";

export type MlFullCostType = "ARMAZENAMENTO" | "COLETA" | "ARMAZENAMENTO_PROLONGADO" | "RETIRADA";

export type MlFullCostRow = {
  type: MlFullCostType;
  costNumber: string;
  costDate: Date;
  /** Null só na aba de Armazenamento geral — o ML não discrimina por SKU ali. */
  sku: string | null;
  listingCode: string | null;
  amount: number;
  details: string | null;
};

export type MlFullCostParseResult = {
  rows: MlFullCostRow[];
  skippedRows: number;
};

const SHEET_TYPES: { match: RegExp; type: MlFullCostType }[] = [
  { match: /armazenamento prolonga/i, type: "ARMAZENAMENTO_PROLONGADO" },
  { match: /retirada de estoque/i, type: "RETIRADA" },
  { match: /servi[cç]o de coleta/i, type: "COLETA" },
  { match: /armazenamento/i, type: "ARMAZENAMENTO" },
];

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Match exato (não substring) — "nº do custo" e "nº do custo estornado" só diferem por uma palavra a mais, então `includes` confundiria os dois. Normaliza os dois lados: sem isso, um `target` com acento (ex.: "anúncio") nunca bate contra um header já sem acento. */
function findExactColumn(headers: string[], target: string): number {
  const normalizedTarget = normalizeHeader(target);
  return headers.findIndex((h) => normalizeHeader(h) === normalizedTarget);
}

function sheetType(sheetName: string): MlFullCostType | null {
  const found = SHEET_TYPES.find((s) => s.match.test(sheetName));
  return found?.type ?? null;
}

function parseSheet(sheet: XLSX.WorkSheet, type: MlFullCostType): { rows: MlFullCostRow[]; skipped: number } {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });

  const headerIndex = matrix.findIndex((row) => normalizeHeader(row[0]) === "nº nf-e");
  if (headerIndex < 0) return { rows: [], skipped: 0 };

  const headers = matrix[headerIndex].map((h) => String(h ?? ""));
  const idxNumber = findExactColumn(headers, "nº do custo") >= 0
    ? findExactColumn(headers, "nº do custo")
    : findExactColumn(headers, "nº da tarifa");
  const idxDate = findExactColumn(headers, "data do custo") >= 0
    ? findExactColumn(headers, "data do custo")
    : findExactColumn(headers, "data da tarifa");
  const idxValue = findExactColumn(headers, "valor do custo") >= 0
    ? findExactColumn(headers, "valor do custo")
    : findExactColumn(headers, "valor da tarifa");
  const idxDetails = findExactColumn(headers, "detalhe");
  const idxSku = findExactColumn(headers, "sku");
  const idxListing = findExactColumn(headers, "nº do anúncio");

  if (idxNumber < 0 || idxDate < 0 || idxValue < 0) {
    return { rows: [], skipped: 0 };
  }

  const rows: MlFullCostRow[] = [];
  let skipped = 0;

  for (let i = headerIndex + 1; i < matrix.length; i++) {
    const cells = matrix[i];
    if (!cells || cells.every((c) => c === null || c === "")) continue;

    const rawNumber = String(cells[idxNumber] ?? "").trim();
    const rawDate = cells[idxDate];
    const costDate = rawDate instanceof Date ? rawDate : null;

    if (!rawNumber || !costDate) {
      skipped += 1;
      continue;
    }

    rows.push({
      type,
      costNumber: `${type}:${rawNumber}`,
      costDate,
      sku: idxSku >= 0 ? String(cells[idxSku] ?? "").trim() || null : null,
      listingCode: idxListing >= 0 ? String(cells[idxListing] ?? "").trim() || null : null,
      amount: parseAmountCell(cells[idxValue]),
      details: idxDetails >= 0 ? String(cells[idxDetails] ?? "").trim() || null : null,
    });
  }

  return { rows, skipped };
}

export function parseMlFullCostWorkbook(buffer: Buffer): MlFullCostParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

  const rows: MlFullCostRow[] = [];
  let skippedRows = 0;
  let anySheetRecognized = false;

  for (const sheetName of workbook.SheetNames) {
    const type = sheetType(sheetName);
    if (!type) continue;
    anySheetRecognized = true;
    const { rows: sheetRows, skipped } = parseSheet(workbook.Sheets[sheetName], type);
    rows.push(...sheetRows);
    skippedRows += skipped;
  }

  if (!anySheetRecognized) {
    throw new Error(
      'Não foi possível reconhecer o Relatório de Tarifas Full — esperado abas como "Tarifa de armazenamento", "Custo por serviço de coleta", "Custo de armazenamento prolongado" ou "Custo por retirada de estoque".',
    );
  }
  if (rows.length === 0) {
    throw new Error("Nenhuma linha de custo Full reconhecida na planilha.");
  }

  return { rows, skippedRows };
}
