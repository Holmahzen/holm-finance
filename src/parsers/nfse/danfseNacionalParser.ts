import { extractPdfText } from "@/parsers/nfse/pdfText";
import type { ParsedNfse } from "@/parsers/nfse/barueriNfseParser";

/**
 * DANFSe v2.0 — o PDF do padrão nacional da NFS-e, que substitui aos poucos os
 * modelos de cada prefeitura. É o formato em que a transportadora do Flex
 * também manda as notas mais novas.
 *
 * Aqui os rótulos ficam numa linha e o valor na linha seguinte ("Valor do
 * Serviço" / "R$ 4.572,48"), diferente do PDF antigo de Barueri, em que
 * rótulo e valor dividem a mesma linha.
 */

function money(raw: string | undefined): number {
  if (!raw) return 0;
  const n = Number(raw.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function digits(raw: string | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

/** Valor que vem na linha logo abaixo do rótulo. */
function below(lines: string[], label: RegExp, offset = 1): string {
  const index = lines.findIndex((line) => label.test(line.trim()));
  if (index < 0) return "";
  return lines[index + offset]?.trim() ?? "";
}

/** Igual a `below`, mas a partir de uma seção específica do documento. */
function belowFrom(lines: string[], section: RegExp, label: RegExp, offset = 1): string {
  const start = lines.findIndex((line) => section.test(line.trim()));
  if (start < 0) return "";
  return below(lines.slice(start), label, offset);
}

function parseDate(raw: string): Date | null {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(raw);
  return m ? new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]))) : null;
}

export function parseDanfseNacionalText(text: string): ParsedNfse {
  if (!/DANFSe/i.test(text) || !/NFS-e/i.test(text)) {
    throw new Error("não é um DANFSe do padrão nacional");
  }

  const lines = text.split(/\r?\n/);
  const issuedOn = parseDate(below(lines, /^DATA\/HORA DA EMISS[ÃA]O DA NFS-E$/i));
  const competence = parseDate(below(lines, /^COMPET[ÊE]NCIA DA NFS-E$/i)) ?? issuedOn;
  if (!issuedOn || !competence) throw new Error("DANFSe sem data de emissão");

  const providerName = belowFrom(lines, /^PRESTADOR \/ FORNECEDOR$/i, /^Nome \/ Nome Empresarial$/i);
  const providerDocument = digits(belowFrom(lines, /^PRESTADOR \/ FORNECEDOR$/i, /^CNPJ \/ CPF \/ NIF$/i));
  const providerCity = belowFrom(lines, /^PRESTADOR \/ FORNECEDOR$/i, /^Munic[íi]pio \/ UF$/i).split("/")[0].trim();
  const recipientDocument = digits(belowFrom(lines, /^TOMADOR \/ ADQUIRENTE$/i, /^CNPJ \/ CPF \/ NIF$/i));

  // "26.01 / 260101220": subitem da lista nacional e código do município.
  const codes = below(lines, /^C[óo]digo de Tributa[çc][ãa]o Nacional \/ Municipal$/i).split("/");

  return {
    providerName,
    providerDocument,
    providerCity,
    recipientDocument,
    amount: money(belowFrom(lines, /^VALOR TOTAL DA NFS-E$/i, /^Valor do Servi[çc]o$/i)),
    netAmount: money(belowFrom(lines, /^VALOR TOTAL DA NFS-E$/i, /^Valor L[íi]quido da NFS-e$/i)),
    issAmount: money(below(lines, /^ISSQN Apurado$/i)),
    issRate: money(below(lines, /^Al[íi]quota Aplicada$/i)),
    issWithheld: /^Retido/i.test(below(lines, /^Reten[çc][ãa]o do ISSQN$/i)) ? money(below(lines, /^ISSQN Apurado$/i)) : 0,
    issuedOn,
    referenceMonth: competence.toISOString().slice(0, 7),
    documentNumber: below(lines, /^N[ÚU]MERO DA NFS-E$/i),
    verificationCode: below(lines, /^CHAVE DE ACESSO DA NFS-E$/i),
    serviceCode: (codes[1] ?? "").trim(),
    serviceItem: (codes[0] ?? "").trim(),
  };
}

export async function parseDanfseNacionalPdf(buffer: Buffer): Promise<ParsedNfse> {
  return parseDanfseNacionalText(await extractPdfText(buffer));
}
