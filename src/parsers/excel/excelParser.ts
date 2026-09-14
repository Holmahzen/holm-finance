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

/**
 * Extratos de verdade em .xlsx/.xls são um ZIP (assinatura "PK") ou OLE
 * (assinatura D0CF11E0) — qualquer outra coisa é texto puro (CSV), como o
 * extrato de conta exportado direto do Mercado Pago.
 */
function isBinarySpreadsheet(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b;
  const isOle = buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0;
  return isZip || isOle;
}

/**
 * O sniffer de tipo do SheetJS, usado pra CSV, lê número e data no padrão
 * americano — "15,39" vira 1539 (derruba a vírgula como se fosse separador
 * de milhar) e "01-05-2026" vira 5 de janeiro em vez de 1º de maio — e
 * decodifica acento como Latin-1 mesmo quando o arquivo é UTF-8. Por isso
 * CSV é lido aqui manualmente, como texto puro célula a célula: quem decide
 * o formato do número e da data são parseAmountCell/parseDateCell, que já
 * leem o padrão brasileiro corretamente.
 */
function csvBufferToRows(buffer: Buffer): Record<string, unknown>[] {
  const text = buffer.toString("utf-8").replace(/^﻿/, "");
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];

  const delimiter = lines[0].includes(";") ? ";" : ",";

  // O extrato de conta do Mercado Pago abre com um resumo de saldo
  // (INITIAL_BALANCE;CREDITS;DEBITS;FINAL_BALANCE) antes da tabela de
  // transações de verdade — pula até a linha RELEASE_DATE, o cabeçalho real.
  const mlHeaderIndex = lines.findIndex((l) => l.toUpperCase().startsWith("RELEASE_DATE"));
  const headerLineIndex = mlHeaderIndex >= 0 ? mlHeaderIndex : 0;

  const headerCells = lines[headerLineIndex].split(delimiter).map((c) => c.trim());
  const rows: Record<string, unknown>[] = [];
  for (let i = headerLineIndex + 1; i < lines.length; i++) {
    const cells = lines[i].split(delimiter);
    const row: Record<string, unknown> = {};
    headerCells.forEach((h, idx) => {
      row[h] = cells[idx] !== undefined ? cells[idx].trim() : null;
    });
    rows.push(row);
  }
  return rows;
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

function synthesizeId(postedAt: Date, memo: string, amount: number, referenceHint?: string): string {
  const key = `${postedAt.toISOString()}|${memo.trim()}|${amount.toFixed(2)}|${referenceHint ?? ""}`;
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 24);
}

export function parseExcel(buffer: Buffer): ExcelStatement {
  let rows: Record<string, unknown>[];

  if (isBinarySpreadsheet(buffer)) {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheet = pickSheet(workbook);
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  } else {
    rows = csvBufferToRows(buffer);
  }

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

    const referenceHint = mapping.referenceHint
      ? String(row[mapping.referenceHint] ?? "").trim() || undefined
      : undefined;

    const externalId =
      externalIdFrom(row, mapping) ?? synthesizeId(postedAt, memo, amount, referenceHint);

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
