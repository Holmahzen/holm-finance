import { XMLParser } from "fast-xml-parser";

export type ParsedFiscalNoteItem = {
  itemNumber: number;
  productCode: string;
  description: string;
  ncm: string;
  cfop: string;
  quantity: number;
  grossValue: number;
  discount: number;
  /** vProd − vDesc + vFrete + vSeg + vOutro do item: o que ele soma no total da nota. */
  netValue: number;
  /** CST (regime normal) ou CSOSN (Simples) do ICMS. */
  icmsCode: string | null;
  icmsBase: number;
  icmsRate: number;
  icmsValue: number;
  /** vCredICMSSN: crédito que fornecedor do Simples autoriza (CSOSN 101/201/900). */
  simplesCreditValue: number;
};

export type ParsedFiscalNote = {
  accessKey: string;
  /** finNFe: 1 normal, 2 complementar, 3 ajuste, 4 devolução. */
  purpose: number;
  /** tpNF: 0 entrada, 1 saída — do ponto de vista de quem emitiu. */
  operationType: number;
  natureOfOperation: string;
  number: number;
  series: number;
  issuedAt: Date;
  /** "YYYY-MM" no fuso de quem emitiu (vem do próprio texto de dhEmi). */
  issueMonth: string;
  issuerDocument: string;
  issuerName: string;
  issuerUf: string;
  issuerCrt: number | null;
  recipientDocument: string | null;
  recipientName: string | null;
  recipientUf: string | null;
  finalConsumer: boolean;
  intermediaryDocument: string | null;
  productsTotal: number;
  discountTotal: number;
  freightTotal: number;
  otherTotal: number;
  total: number;
  icmsTotal: number;
  icmsStTotal: number;
  ipiTotal: number;
  pisTotal: number;
  cofinsTotal: number;
  difalTotal: number;
  simplesCreditTotal: number;
  /** Chaves de acesso citadas em NFref — a devolução aponta a venda original. */
  referencedKeys: string[];
  items: ParsedFiscalNoteItem[];
};

export type ParsedNfeFile =
  | { kind: "note"; note: ParsedFiscalNote }
  | { kind: "cancellation"; accessKey: string; cancelledAt: Date }
  | { kind: "ignored"; reason: string };

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  removeNSPrefix: true,
  // Tudo como texto: "0010" de CFOP/NCM e chaves de 44 dígitos não podem virar número.
  parseTagValue: false,
  trimValues: true,
  isArray: (name) => name === "det" || name === "NFref",
});

const EVENT_CANCELLATION = "110111";
/** 135/136: evento registrado; 155: cancelamento homologado fora de prazo. */
const EVENT_ACCEPTED = new Set(["135", "136", "155"]);
/** 100: autorizada; 150: autorizada fora de prazo. */
const NOTE_AUTHORIZED = new Set(["100", "150"]);

type XmlNode = Record<string, unknown>;

function node(value: unknown): XmlNode {
  return value && typeof value === "object" ? (value as XmlNode) : {};
}

function text(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") return String((value as XmlNode)["#text"] ?? "");
  return String(value);
}

function money(value: unknown): number {
  const t = text(value);
  if (t === "") return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

function optional(value: unknown): string | null {
  const t = text(value);
  return t === "" ? null : t;
}

export function parseNfeXml(xml: string): ParsedNfeFile {
  let doc: XmlNode;
  try {
    doc = parser.parse(xml) as XmlNode;
  } catch {
    return { kind: "ignored", reason: "XML ilegível" };
  }

  if (doc.procEventoNFe || doc.evento) return parseEvent(doc);
  if (doc.resNFe || doc.resEvento) {
    return { kind: "ignored", reason: "resumo da SEFAZ, sem os itens da nota" };
  }

  const nfe = node(doc.nfeProc ? node(doc.nfeProc).NFe : doc.NFe);
  const inf = node(nfe.infNFe);
  if (!inf.ide) return { kind: "ignored", reason: "não é um XML de NF-e" };

  const protocol = node(node(node(doc.nfeProc).protNFe).infProt);
  const status = text(protocol.cStat);
  if (status && !NOTE_AUTHORIZED.has(status)) {
    return { kind: "ignored", reason: `nota não autorizada pela SEFAZ (situação ${status})` };
  }

  const ide = node(inf.ide);
  if (text(ide.mod) !== "55") {
    return { kind: "ignored", reason: `modelo ${text(ide.mod) || "?"} (só NF-e modelo 55 é lida)` };
  }
  if (text(ide.tpAmb) === "2") return { kind: "ignored", reason: "nota de teste (homologação)" };

  const accessKey = text(protocol.chNFe) || text(inf["@Id"]).replace(/^NFe/, "");
  if (!/^\d{44}$/.test(accessKey)) return { kind: "ignored", reason: "nota sem chave de acesso válida" };

  const issuedText = text(ide.dhEmi) || text(ide.dEmi);
  const issuedAt = new Date(issuedText);
  if (!issuedText || Number.isNaN(issuedAt.getTime())) {
    return { kind: "ignored", reason: "nota sem data de emissão" };
  }

  const emit = node(inf.emit);
  const dest = node(inf.dest);
  const totals = node(node(inf.total).ICMSTot);

  const items = ((inf.det as unknown[] | undefined) ?? []).map((raw) => parseItem(node(raw)));

  return {
    kind: "note",
    note: {
      accessKey,
      purpose: Number(text(ide.finNFe)) || 1,
      operationType: Number(text(ide.tpNF)),
      natureOfOperation: text(ide.natOp),
      number: Number(text(ide.nNF)) || 0,
      series: Number(text(ide.serie)) || 0,
      issuedAt,
      issueMonth: issuedText.slice(0, 7),
      issuerDocument: text(emit.CNPJ) || text(emit.CPF),
      issuerName: text(emit.xNome),
      issuerUf: text(node(emit.enderEmit).UF),
      issuerCrt: optional(emit.CRT) === null ? null : Number(text(emit.CRT)),
      recipientDocument: optional(dest.CNPJ) ?? optional(dest.CPF) ?? optional(dest.idEstrangeiro),
      recipientName: optional(dest.xNome),
      recipientUf: optional(node(dest.enderDest).UF),
      finalConsumer: text(ide.indFinal) === "1",
      intermediaryDocument: optional(node(inf.infIntermed).CNPJ),
      productsTotal: money(totals.vProd),
      discountTotal: money(totals.vDesc),
      freightTotal: money(totals.vFrete),
      otherTotal: money(totals.vOutro),
      total: money(totals.vNF),
      icmsTotal: money(totals.vICMS),
      icmsStTotal: money(totals.vST),
      ipiTotal: money(totals.vIPI),
      pisTotal: money(totals.vPIS),
      cofinsTotal: money(totals.vCOFINS),
      difalTotal: money(totals.vICMSUFDest),
      simplesCreditTotal: items.reduce((sum, i) => sum + i.simplesCreditValue, 0),
      referencedKeys: ((ide.NFref as unknown[] | undefined) ?? [])
        .map((ref) => text(node(ref).refNFe))
        .filter((k) => k !== ""),
      items,
    },
  };
}

function parseItem(det: XmlNode): ParsedFiscalNoteItem {
  const prod = node(det.prod);
  const icmsGroup = node(node(det.imposto).ICMS);
  const icms = node(icmsGroup[Object.keys(icmsGroup)[0]]);
  const grossValue = money(prod.vProd);
  const discount = money(prod.vDesc);

  return {
    itemNumber: Number(text(det["@nItem"])) || 0,
    productCode: text(prod.cProd),
    description: text(prod.xProd),
    ncm: text(prod.NCM),
    cfop: text(prod.CFOP),
    quantity: money(prod.qCom),
    grossValue,
    discount,
    netValue: grossValue - discount + money(prod.vFrete) + money(prod.vSeg) + money(prod.vOutro),
    icmsCode: optional(icms.CSOSN) ?? optional(icms.CST),
    icmsBase: money(icms.vBC),
    icmsRate: money(icms.pICMS),
    icmsValue: money(icms.vICMS),
    simplesCreditValue: money(icms.vCredICMSSN),
  };
}

function parseEvent(doc: XmlNode): ParsedNfeFile {
  const proc = node(doc.procEventoNFe);
  const info = node(node(proc.evento ?? doc.evento).infEvento);
  const type = text(info.tpEvento);

  if (type !== EVENT_CANCELLATION) {
    const description = text(node(info.detEvento).descEvento) || `tipo ${type || "?"}`;
    return { kind: "ignored", reason: `evento "${description}" (só o cancelamento é usado)` };
  }

  const answer = node(node(proc.retEvento).infEvento);
  const status = text(answer.cStat);
  if (status && !EVENT_ACCEPTED.has(status)) {
    return { kind: "ignored", reason: `cancelamento recusado pela SEFAZ (situação ${status})` };
  }

  const accessKey = text(info.chNFe);
  const cancelledAt = new Date(text(answer.dhRegEvento) || text(info.dhEvento));
  if (!/^\d{44}$/.test(accessKey) || Number.isNaN(cancelledAt.getTime())) {
    return { kind: "ignored", reason: "evento de cancelamento incompleto" };
  }
  return { kind: "cancellation", accessKey, cancelledAt };
}
