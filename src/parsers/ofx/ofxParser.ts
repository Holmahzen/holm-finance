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
    trnType: raw.TRNTYPE === "CREDIT" ? "CREDIT" : "DEBIT",
    postedAt: parseOfxDate(String(raw.DTPOSTED)),
    amount: String(raw.TRNAMT),
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
    ledgerBalance: String(ledgerBal?.BALAMT ?? "0"),
    ledgerBalanceDate: parseOfxDate(String(ledgerBal?.DTASOF)),
  };
}
