import { extractPdfText } from "@/parsers/nfse/pdfText";

/**
 * NFS-e da Prefeitura de Barueri em PDF — é assim que a transportadora do
 * Flex (J3 Envios) cobra o frete da Holm. Diferente do demonstrativo do
 * Mercado Livre, esta é a nota inteira: traz prestador, tomador, código do
 * serviço, valor, alíquota e ISS.
 */

export type ParsedNfse = {
  providerName: string;
  providerDocument: string;
  providerCity: string;
  recipientDocument: string;
  amount: number;
  netAmount: number;
  issAmount: number;
  issRate: number;
  /** ISS retido na fonte: quando maior que zero, quem recolhe é o tomador. */
  issWithheld: number;
  issuedOn: Date;
  /** "YYYY-MM" da competência (o mês do serviço). */
  referenceMonth: string;
  documentNumber: string;
  verificationCode: string;
  /** Código do serviço no município (ex.: 260101220). */
  serviceCode: string;
  /** Subitem da lista da LC 116/03 (ex.: 26.01). */
  serviceItem: string;
};

function money(raw: string | undefined): number {
  if (!raw) return 0;
  const n = Number(raw.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function digits(raw: string | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

function field(text: string, pattern: RegExp): string | undefined {
  return pattern.exec(text)?.[1]?.trim();
}

/** Valor logo abaixo de um rótulo que fica sozinho na linha ("Número", "Emitida em"...). */
function below(lines: string[], label: RegExp): string {
  const index = lines.findIndex((line) => label.test(line.trim()));
  if (index < 0) return "";
  return lines.slice(index + 1).find((line) => line.trim() !== "")?.trim() ?? "";
}

function parseDate(raw: string): Date | null {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(raw);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
}

export function parseBarueriNfseText(text: string): ParsedNfse {
  if (!/NFS-e/i.test(text) || !/Prefeitura de Barueri/i.test(text)) {
    throw new Error("não é uma NFS-e da Prefeitura de Barueri");
  }

  const lines = text.split(/\r?\n/);
  const issuedOn = parseDate(below(lines, /^Emitida em$/i));
  const competence = parseDate(below(lines, /^Compet[êe]ncia$/i)) ?? issuedOn;
  if (!issuedOn || !competence) throw new Error("NFS-e sem data de emissão");

  const documentNumber = below(lines, /^N[úu]mero$/i);
  const verificationCode = below(lines, /^C[óo]d\.?\s*Verifica[çc][ãa]o$/i);

  // O nome do prestador vem logo depois do código de verificação; o CNPJ dele
  // é o primeiro do documento (o do tomador aparece depois, como "CPF/CNPJ").
  const afterCode = lines.findIndex((line) => line.trim() === verificationCode && verificationCode !== "");
  const providerName = lines.slice(afterCode + 1).find((line) => line.trim() !== "")?.trim() ?? "";
  const providerDocument = digits(field(text, /CNPJ:\s*([\d./-]+)/));

  const recipientIndex = lines.findIndex((line) => /Tomador dos Servi[çc]os/i.test(line));
  const providerBlock = lines.slice(0, recipientIndex < 0 ? undefined : recipientIndex);
  const cityLine = [...providerBlock].reverse().find((line) => /\s{2,}|\t/.test(line) && /[A-Z]{2}\s*$/.test(line.trim()));
  const providerCity = cityLine ? cityLine.trim().split(/\s{2,}|\t/)[0].trim() : "";

  const recipientDocument = digits(
    field(text.slice(recipientIndex < 0 ? 0 : text.indexOf("Tomador")), /CPF\/CNPJ:\s*([\d./-]+)/),
  );

  const serviceCode = field(text, /C[óo]digo do Servi[çc]o\s*\n\s*(\d+)/) ?? "";
  const serviceItem = field(text, /Lei complementar 116\/03\)\s*\n\s*([\d.]+)/) ?? "";

  return {
    providerName,
    providerDocument,
    providerCity,
    recipientDocument,
    amount: money(field(text, /Valor dos servi[çc]os\s*\t?\s*R\$\s*([\d.,]+)/i)),
    netAmount: money(field(text, /Valor L[íi]quido\s*\t?\s*R\$\s*([\d.,]+)/i)),
    issAmount: money(field(text, /\(=\)\s*Valor do ISS\s*\t?\s*R\$\s*([\d.,]+)/i)),
    issRate: money(field(text, /\(x\)\s*Al[íi]quota\s*\t?\s*([\d.,]+)\s*%/i)),
    issWithheld: money(field(text, /ISS Retido na Fonte\s*\t?\s*R\$\s*([\d.,]+)/i)),
    issuedOn,
    referenceMonth: competence.toISOString().slice(0, 7),
    documentNumber,
    verificationCode,
    serviceCode,
    serviceItem,
  };
}

export async function parseBarueriNfsePdf(buffer: Buffer): Promise<ParsedNfse> {
  return parseBarueriNfseText(await extractPdfText(buffer));
}
