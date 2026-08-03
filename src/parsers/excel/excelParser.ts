import * as XLSX from "xlsx";
import crypto from "node:crypto";
import { mapHeaders, detectFormat } from "./columnMapping";
import { parseAmountCell, parseDateCell } from "./amountAndDate";
import type { ExcelStatement, ExcelTransaction } from "./types";

function pickSheet(workbook: XLSX.WorkBook): XLSX.WorkSheet {
  const named = workbook.SheetNames.find((n) => /transac/i.test(n));
  const sheetName = named ?? workbook.SheetNames[0];
  return workbook.Sheets[sheetName];
}

function externalIdFrom(row: Record<string, unknown>, mapping: ReturnType<typeof mapHeaders>): string {
  if (mapping.externalId) {
    const raw = row[mapping.externalId];
    if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
      return String(raw).trim();
    }
  }
  return null as unknown as string;
}

function synthesizeId(postedAt: Date, memo: string, amount: number): string {
  const key = `${postedAt.toISOString()}|${memo.trim()}|${amount.toFixed(2)}`;
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 24);
}

export function parseExcel(buffer: Buffer): ExcelStatement {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = pickSheet(workbook);
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

  if (rows.length === 0) {
    throw new Error("A planilha não contém linhas de dados.");
  }

  const headers = Object.keys(rows[0]);
  const mapping = mapHeaders(headers);
  const format = detectFormat(mapping);

  if (!format) {
    throw new Error(
      "Não foi possível reconhecer o formato da planilha. Esperado: colunas Data + Descrição, e (Entrada + Saída) ou (Valor).",
    );
  }

  const transactions: ExcelTransaction[] = [];

  for (const row of rows) {
    const postedAt = mapping.date ? parseDateCell(row[mapping.date]) : null;
    const memoRaw = mapping.description ? row[mapping.description] : null;
    if (!postedAt || memoRaw === null || memoRaw === undefined) continue;

    const memo = String(memoRaw).trim();
    if (!memo) continue;

    let amount: number;
    let trnType: "DEBIT" | "CREDIT";

    if (format === "mercado_pago") {
      const entrada = parseAmountCell(mapping.entrada ? row[mapping.entrada] : null);
      const saida = parseAmountCell(mapping.saida ? row[mapping.saida] : null);
      if (entrada > 0) {
        amount = entrada;
        trnType = "CREDIT";
      } else if (saida > 0) {
        amount = -saida;
        trnType = "DEBIT";
      } else {
        continue;
      }
    } else {
      const rawAmount = parseAmountCell(mapping.amount ? row[mapping.amount] : null);
      if (rawAmount === 0) continue;

      const typeText = mapping.type
        ? String(row[mapping.type] ?? "")
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .toLowerCase()
        : "";
      const explicitDebit = /debit|saida|despesa|pagar/.test(typeText);
      const explicitCredit = /credit|entrada|receita|receber/.test(typeText);

      if (explicitDebit) {
        amount = -Math.abs(rawAmount);
        trnType = "DEBIT";
      } else if (explicitCredit) {
        amount = Math.abs(rawAmount);
        trnType = "CREDIT";
      } else {
        amount = rawAmount;
        trnType = rawAmount < 0 ? "DEBIT" : "CREDIT";
      }
    }

    const counterpartyName = mapping.counterparty
      ? String(row[mapping.counterparty] ?? "").trim() || undefined
      : undefined;

    const externalId =
      externalIdFrom(row, mapping) ?? synthesizeId(postedAt, memo, amount);

    transactions.push({
      externalId,
      trnType,
      postedAt,
      amount: amount.toFixed(2),
      memo,
      counterpartyName,
    });
  }

  return { format, transactions };
}
