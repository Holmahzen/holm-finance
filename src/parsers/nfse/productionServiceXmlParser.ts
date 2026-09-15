import { XMLParser } from "fast-xml-parser";

/**
 * XML da NFS-e no padrão nacional (schema sped.fazenda.gov.br/nfse) — o
 * arquivo que a prefeitura entrega, mais confiável de ler que o PDF (DANFSe)
 * gerado a partir dele.
 */

export type ParsedProductionServiceNote = {
  accessKey: string;
  providerDocument: string;
  providerName: string;
  recipientDocument: string;
  recipientName: string;
  serviceDescription: string;
  /** Texto do item da lista nacional de serviços (xTribNac) — usado junto com
   * serviceDescription pra adivinhar a categoria quando a descrição é curta. */
  taxDescription: string;
  amount: number;
  issuedOn: Date;
  /** "YYYY-MM" da competência do serviço. */
  referenceMonth: string;
  documentNumber: string;
};

export type ParsedProductionServiceXml =
  | { kind: "note"; note: ParsedProductionServiceNote }
  | { kind: "ignored"; reason: string };

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
});

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

export function parseProductionServiceXml(xml: string): ParsedProductionServiceXml {
  let doc: XmlNode;
  try {
    doc = parser.parse(xml) as XmlNode;
  } catch {
    return { kind: "ignored", reason: "XML ilegível" };
  }

  const infNFSe = node(node(doc.NFSe).infNFSe);
  if (!infNFSe.nNFSe) return { kind: "ignored", reason: "não é um XML de NFS-e do padrão nacional" };

  const dps = node(node(infNFSe.DPS).infDPS);
  const prest = node(dps.prest);
  const toma = node(dps.toma);
  const cServ = node(node(dps.serv).cServ);
  const servPrest = node(node(dps.valores).vServPrest);
  const emit = node(infNFSe.emit);

  const issuedText = text(dps.dhEmi) || text(infNFSe.dhProc);
  const issuedOn = issuedText ? new Date(issuedText) : null;
  if (!issuedOn || Number.isNaN(issuedOn.getTime())) {
    return { kind: "ignored", reason: "nota sem data de emissão" };
  }

  const competText = text(dps.dCompet) || issuedText;

  const accessKey = text(infNFSe["@Id"]).replace(/^NFS/, "");
  if (!accessKey) return { kind: "ignored", reason: "nota sem chave de acesso" };

  const providerDocument = text(emit.CNPJ) || text(emit.CPF) || text(prest.CNPJ) || text(prest.CPF);
  const recipientDocument = text(toma.CNPJ) || text(toma.CPF);
  if (!providerDocument || !recipientDocument) {
    return { kind: "ignored", reason: "nota sem CNPJ/CPF de prestador ou tomador" };
  }

  const amount = money(node(infNFSe.valores).vLiq) || money(servPrest.vServ);

  return {
    kind: "note",
    note: {
      accessKey,
      providerDocument,
      providerName: text(emit.xNome),
      recipientDocument,
      recipientName: text(toma.xNome),
      serviceDescription: text(cServ.xDescServ),
      taxDescription: text(infNFSe.xTribNac),
      amount,
      issuedOn,
      referenceMonth: competText.slice(0, 7),
      documentNumber: text(infNFSe.nNFSe),
    },
  };
}
