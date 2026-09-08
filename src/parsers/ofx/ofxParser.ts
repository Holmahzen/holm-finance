import { XMLParser } from "fast-xml-parser";
import { decodeOfxBuffer } from "./encoding";
import { parseOfxHeader } from "./ofxHeader";
import { sgmlToXml } from "./sgmlToXml";
import { parseOfxDate } from "./dateParser";
import type { OfxStatement, OfxTransaction } from "./types";

const xmlParser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  trimValues: true,
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Valor monetário do OFX, tolerando o formato brasileiro.
 *
 * O padrão manda `13895.04`, e é assim que o Sicredi escreve. O PagBank manda
 * `R$ 13.895,04` no BALAMT — com símbolo, ponto de milhar e vírgula decimal.
 * Sem tratar, o saldo do extrato viraria NaN e a conferência com o lote
 * anterior deixaria de valer.
 */
export function parseOfxAmount(raw: string): string {
  const texto = String(raw ?? "").trim();
  if (texto === "") return "0";

  const limpo = texto.replace(/[^\d,.-]/g, "");
  // Vírgula presente = formato brasileiro: ponto é milhar, vírgula é decimal.
  const normalizado = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo;

  return Number.isNaN(Number(normalizado)) ? "0" : normalizado;
}

/**
 * Sentido da transação.
 *
 * O padrão OFX usa CREDIT/DEBIT, mas o PagBank usa IN/OUT. Cair no `else` e
 * marcar tudo como DEBIT seria pior que um erro: não quebra nada, só grava
 * toda ENTRADA como saída — e depois vira lançamento "a pagar" em
 * createEntryFromTransaction, que decide por este campo.
 */
function normalizarTipo(raw: unknown): "CREDIT" | "DEBIT" {
  const tipo = String(raw ?? "").trim().toUpperCase();
  if (tipo === "CREDIT" || tipo === "IN" || tipo === "DEP" || tipo === "DIRECTDEP") {
    return "CREDIT";
  }
  return "DEBIT";
}

export function parseOfx(buffer: Buffer): OfxStatement {
  const decoded = decodeOfxBuffer(buffer);
  const { body } = parseOfxHeader(decoded);
  const xml = sgmlToXml(body);
  const doc = xmlParser.parse(xml);

  const stmtrs = doc?.OFX?.BANKMSGSRSV1?.STMTTRNRS?.STMTRS;
  if (!stmtrs) {
    throw new Error("Arquivo OFX inválido: STMTRS não encontrado.");
  }

  const acctFrom = stmtrs.BANKACCTFROM;
  const tranList = stmtrs.BANKTRANLIST;
  const ledgerBal = stmtrs.LEDGERBAL;

  const transactions: OfxTransaction[] = asArray(tranList?.STMTTRN).map((raw) => ({
    trnType: normalizarTipo(raw.TRNTYPE),
    postedAt: parseOfxDate(String(raw.DTPOSTED)),
    amount: parseOfxAmount(String(raw.TRNAMT)),
    fitId: String(raw.FITID),
    memo: String(raw.MEMO ?? ""),
  }));

  return {
    bankId: String(acctFrom?.BANKID ?? ""),
    acctId: String(acctFrom?.ACCTID ?? ""),
    acctType: String(acctFrom?.ACCTTYPE ?? ""),
    currency: String(stmtrs.CURDEF ?? "BRL"),
    dtStart: parseOfxDate(String(tranList?.DTSTART)),
    dtEnd: parseOfxDate(String(tranList?.DTEND)),
    transactions,
    ledgerBalance: parseOfxAmount(String(ledgerBal?.BALAMT ?? "0")),
    ledgerBalanceDate: parseOfxDate(String(ledgerBal?.DTASOF)),
  };
}
