import * as XLSX from "xlsx";

/**
 * Lê planilha (.xlsx/.xls) ou CSV.
 *
 * No CSV, o SheetJS adivinha o tipo de cada célula no padrão americano: "67,56"
 * vira o número 6756 (vírgula como separador de milhar) e "09/10/2026" vira 10
 * de setembro. Foi o que multiplicou por 100 as vendas do relatório do Mercado
 * Turbo em CSV de 09–12/10/2026 e espalhou as datas por outros meses. Com
 * `raw`, as células ficam como texto e quem lê (parseAmountCell/parseDateCell)
 * interpreta no padrão brasileiro. Em .xlsx nada muda.
 */
export function readWorkbook(buffer: Buffer): XLSX.WorkBook {
  // .xlsx é um zip ("PK"); .xls é OLE2 (D0 CF). Qualquer outra coisa é texto/CSV.
  const isZip = buffer[0] === 0x50 && buffer[1] === 0x4b;
  const isOle = buffer[0] === 0xd0 && buffer[1] === 0xcf;
  if (isZip || isOle) return XLSX.read(buffer, { type: "buffer", cellDates: true });

  return XLSX.read(decodeText(buffer), { type: "string", cellDates: true, raw: true });
}

/** UTF-8 (com ou sem BOM) ou, se não for UTF-8 válido, Windows-1252 — o que o Excel em português grava. */
function decodeText(buffer: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}
