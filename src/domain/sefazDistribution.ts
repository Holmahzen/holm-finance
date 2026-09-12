import { gunzipSync } from "node:zlib";
import { XMLParser } from "fast-xml-parser";

/**
 * Distribuição DF-e: o serviço da Receita que entrega os documentos emitidos
 * **contra** o CNPJ da empresa. Cada consulta devolve um lote a partir de um
 * número sequencial (NSU) e cada documento vem compactado em base64.
 *
 * O que vem em cada lote:
 * - `resNFe`: o **resumo** da nota de um fornecedor (chave, emitente, valor,
 *   data, situação). É o que chega antes da manifestação — não tem itens.
 * - `procNFe`: a **nota inteira**, com itens e impostos. A Receita só entrega
 *   depois da manifestação de "Ciência da Operação".
 * - `resEvento` / `procEventoNFe`: eventos, inclusive cancelamento.
 */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
});

export type SefazDocumentKind = "resumo" | "nota" | "evento" | "outro";

export type SefazDocument = {
  nsu: string;
  /** Ex.: "resNFe_v1.01", "procNFe_v4.00". */
  schema: string;
  kind: SefazDocumentKind;
  accessKey: string | null;
  issuerDocument: string | null;
  issuerName: string | null;
  issuedAt: Date | null;
  total: number | null;
  /** cSitNFe do resumo: 1 autorizada, 2 cancelada, 3 denegada. */
  situation: string | null;
  xml: string;
};

export type SefazDistributionResult = {
  /** cStat: 138 documentos localizados, 137 nenhum documento, 656 consumo indevido. */
  status: string;
  message: string;
  /** Último NSU que veio neste lote — é daqui que a próxima consulta continua. */
  lastNsu: string;
  /** Maior NSU que existe na Receita: se for maior que o último, ainda há documentos. */
  maxNsu: string;
  documents: SefazDocument[];
};

type XmlNode = Record<string, unknown>;

function node(value: unknown): XmlNode {
  return value && typeof value === "object" ? (value as XmlNode) : {};
}

function text(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") return String((value as XmlNode)["#text"] ?? "");
  return String(value);
}

function optional(value: unknown): string | null {
  const t = text(value);
  return t === "" ? null : t;
}

function kindOf(schema: string): SefazDocumentKind {
  if (schema.startsWith("resNFe")) return "resumo";
  if (schema.startsWith("procNFe") || schema.startsWith("nfeProc")) return "nota";
  if (schema.startsWith("resEvento") || schema.startsWith("procEvento")) return "evento";
  return "outro";
}

/** Monta o envelope SOAP da consulta por NSU. */
export function buildDistributionEnvelope(options: {
  cnpj: string;
  /** 1 produção, 2 homologação. */
  environment: "1" | "2";
  /** Código da UF do autor da consulta (35 = SP). */
  ufCode: string;
  /** Último NSU já lido; "0" começa do início. */
  lastNsu: string;
}): string {
  const nsu = options.lastNsu.replace(/\D/g, "").padStart(15, "0");
  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg>
        <distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01">
          <tpAmb>${options.environment}</tpAmb>
          <cUFAutor>${options.ufCode}</cUFAutor>
          <CNPJ>${options.cnpj}</CNPJ>
          <distNSU><ultNSU>${nsu}</ultNSU></distNSU>
        </distDFeInt>
      </nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>`;
}

function summarize(xml: string, schema: string): Omit<SefazDocument, "nsu" | "schema" | "kind" | "xml"> {
  const doc = parser.parse(xml) as XmlNode;
  const kind = kindOf(schema);

  if (kind === "resumo") {
    const res = node(doc.resNFe);
    return {
      accessKey: optional(res.chNFe),
      issuerDocument: optional(res.CNPJ) ?? optional(res.CPF),
      issuerName: optional(res.xNome),
      issuedAt: res.dhEmi ? new Date(text(res.dhEmi)) : null,
      total: res.vNF ? Number(text(res.vNF)) : null,
      situation: optional(res.cSitNFe),
    };
  }

  if (kind === "nota") {
    const inf = node(node(node(doc.nfeProc ?? doc.procNFe).NFe).infNFe);
    const emit = node(inf.emit);
    const totals = node(node(inf.total).ICMSTot);
    return {
      accessKey: text(inf["@Id"]).replace(/^NFe/, "") || null,
      issuerDocument: optional(emit.CNPJ) ?? optional(emit.CPF),
      issuerName: optional(emit.xNome),
      issuedAt: node(inf.ide).dhEmi ? new Date(text(node(inf.ide).dhEmi)) : null,
      total: totals.vNF ? Number(text(totals.vNF)) : null,
      situation: null,
    };
  }

  if (kind === "evento") {
    const info = node(node(node(doc.procEventoNFe ?? doc.resEvento).evento ?? doc.resEvento).infEvento);
    const fallback = node(node(doc.resEvento).infEvento ?? doc.resEvento);
    const source = Object.keys(info).length > 0 ? info : fallback;
    return {
      accessKey: optional(source.chNFe),
      issuerDocument: optional(source.CNPJ) ?? optional(source.CPF),
      issuerName: null,
      issuedAt: source.dhEvento ? new Date(text(source.dhEvento)) : null,
      total: null,
      situation: optional(source.tpEvento),
    };
  }

  return { accessKey: null, issuerDocument: null, issuerName: null, issuedAt: null, total: null, situation: null };
}

export function parseDistributionResponse(soapXml: string): SefazDistributionResult {
  const doc = parser.parse(soapXml) as XmlNode;
  const ret = node(
    node(node(node(doc.Envelope).Body).nfeDistDFeInteresseResponse).nfeDistDFeInteresseResult ??
      node(node(doc.Envelope).Body).retDistDFeInt,
  );
  const answer = node(ret.retDistDFeInt ?? ret);

  const lote = node(answer.loteDistDFeInt);
  const raw = lote.docZip == null ? [] : Array.isArray(lote.docZip) ? lote.docZip : [lote.docZip];

  const documents = raw.map((entry) => {
    const item = node(entry);
    const nsu = text(item["@NSU"]);
    const schema = text(item["@schema"]);
    const xml = gunzipSync(Buffer.from(text(item), "base64")).toString("utf8");
    return { nsu, schema, kind: kindOf(schema), xml, ...summarize(xml, schema) };
  });

  return {
    status: text(answer.cStat),
    message: text(answer.xMotivo),
    lastNsu: text(answer.ultNSU),
    maxNsu: text(answer.maxNSU),
    documents,
  };
}

/** Ainda há documentos além do último lote? */
export function hasMore(result: SefazDistributionResult): boolean {
  const last = Number(result.lastNsu || 0);
  const max = Number(result.maxNsu || 0);
  return result.status === "138" && last > 0 && last < max;
}
