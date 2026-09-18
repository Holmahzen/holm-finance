import * as XLSX from "xlsx";
import { parseAmountCell } from "@/parsers/excel/amountAndDate";

export type MlAdSpendRow = {
  listingCode: string;
  adTitle: string;
  campaignName: string;
  periodStart: Date;
  periodEnd: Date;
  investimento: number;
  receita: number;
  cliques: number;
  impressoes: number;
};

export type MlAdsParseResult = {
  rows: MlAdSpendRow[];
  skippedRows: number;
};

const MONTHS_PT: Record<string, number> = {
  jan: 0,
  fev: 1,
  mar: 2,
  abr: 3,
  mai: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  set: 8,
  out: 9,
  nov: 10,
  dez: 11,
};

/** O relatório de Ads do Mercado Livre grava as datas como texto
 * "19-jun-2026" (dia-mês abreviado em português-ano), não como data de
 * planilha de verdade — nenhum parser de data já existente no projeto lê
 * esse formato. */
function parsePtDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
  }
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  const match = text.match(/^(\d{1,2})-([a-zç]{3})-(\d{4})$/);
  if (!match) return null;
  const [, day, monthAbbr, year] = match;
  const month = MONTHS_PT[monthAbbr];
  if (month === undefined) return null;
  return new Date(Date.UTC(Number(year), month, Number(day)));
}

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function findColumn(headers: string[], keyword: string): number {
  return headers.findIndex((h) => normalizeHeader(h).includes(keyword));
}

function pickSheet(workbook: XLSX.WorkBook): XLSX.WorkSheet {
  const named = workbook.SheetNames.find((n) => /anuncio/i.test(n));
  const sheetName = named ?? workbook.SheetNames[workbook.SheetNames.length - 1];
  return workbook.Sheets[sheetName];
}

export function parseMlAdsWorkbook(buffer: Buffer): MlAdsParseResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = pickSheet(workbook);
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });

  // A planilha abre com linhas de título/resumo antes da tabela de verdade —
  // acha a linha de cabeçalho real procurando "Código do anúncio", a única
  // coluna que não muda de nome entre os relatórios de Ads do ML.
  const headerIndex = matrix.findIndex((row) =>
    row.some((cell) => normalizeHeader(cell).includes("codigo do anuncio")),
  );
  if (headerIndex < 0) {
    throw new Error(
      'Não foi possível reconhecer o relatório de Ads — coluna "Código do anúncio" não encontrada. Esperado o relatório "Anúncios patrocinados" (com a coluna Investimento), não o de "Anúncios vendidos".',
    );
  }

  const headers = matrix[headerIndex].map((h) => String(h ?? ""));
  const idxDesde = findColumn(headers, "desde");
  const idxAte = findColumn(headers, "ate");
  const idxCampanha = findColumn(headers, "campanha");
  const idxTitulo = findColumn(headers, "titulo do anuncio patrocinado");
  const idxCodigo = findColumn(headers, "codigo do anuncio");
  const idxInvestimento = findColumn(headers, "investimento");
  const idxReceita = findColumn(headers, "receita");
  const idxCliques = findColumn(headers, "cliques");
  const idxImpressoes = findColumn(headers, "impressoes");

  if (idxCodigo < 0 || idxInvestimento < 0 || idxDesde < 0 || idxAte < 0) {
    throw new Error(
      'Relatório de Ads em formato inesperado — esperado colunas "Desde", "Até", "Código do anúncio" e "Investimento".',
    );
  }

  const rows: MlAdSpendRow[] = [];
  let skippedRows = 0;

  for (let i = headerIndex + 1; i < matrix.length; i++) {
    const cells = matrix[i];
    if (!cells || cells.every((c) => c === null || c === "")) continue;

    const listingCode = String(cells[idxCodigo] ?? "").trim();
    const periodStart = parsePtDate(cells[idxDesde]);
    const periodEnd = parsePtDate(cells[idxAte]);

    if (!listingCode || !periodStart || !periodEnd) {
      skippedRows += 1;
      continue;
    }

    rows.push({
      listingCode,
      adTitle: idxTitulo >= 0 ? String(cells[idxTitulo] ?? "").trim() : "",
      campaignName: idxCampanha >= 0 ? String(cells[idxCampanha] ?? "").trim() : "",
      periodStart,
      periodEnd,
      investimento: parseAmountCell(cells[idxInvestimento]),
      receita: idxReceita >= 0 ? parseAmountCell(cells[idxReceita]) : 0,
      cliques: idxCliques >= 0 ? Math.round(parseAmountCell(cells[idxCliques])) : 0,
      impressoes: idxImpressoes >= 0 ? Math.round(parseAmountCell(cells[idxImpressoes])) : 0,
    });
  }

  if (rows.length === 0) {
    throw new Error("Nenhuma linha de investimento em Ads reconhecida na planilha.");
  }

  return { rows, skippedRows };
}
