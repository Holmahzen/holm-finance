import type { Prisma } from "@/generated/prisma/client";
import { parseMlServiceStatementPdf } from "@/parsers/nfse/mlServiceStatementParser";
import { parseBarueriNfsePdf } from "@/parsers/nfse/barueriNfseParser";
import { parseDanfseNacionalPdf } from "@/parsers/nfse/danfseNacionalParser";
import { parseBarueriNfseXml } from "@/parsers/nfse/barueriNfseXmlParser";
import type { ParsedNfse } from "@/parsers/nfse/barueriNfseParser";
import { COMPANY_DOCUMENTS } from "@/domain/fiscalNotes";
import { mlServiceDedupeKey } from "@/domain/mlServices";
import { mlServiceInvoiceRepository } from "@/repositories/mlServiceInvoiceRepository";

export type PdfFile = { name: string; base64: string };

export type ImportMlServicesResult = {
  files: number;
  newInvoices: number;
  existingInvoices: number;
  ignored: { reason: string; count: number; example: string }[];
};

/**
 * Dois PDFs diferentes caem aqui: o "Demonstrativo de Nota Fiscal" do Mercado
 * Livre (só a folha de rosto) e a NFS-e inteira da Prefeitura de Barueri, que
 * é como a transportadora do Flex cobra o frete — essa traz serviço, alíquota
 * e ISS. Tenta um leitor, depois o outro.
 */
async function toInvoice(
  buffer: Buffer,
  fileName: string,
): Promise<Prisma.MlServiceInvoiceCreateManyInput> {
  try {
    const statement = await parseMlServiceStatementPdf(buffer);
    return {
      dedupeKey: mlServiceDedupeKey(statement, fileName),
      providerName: statement.providerName,
      providerDocument: statement.providerDocument,
      providerCity: statement.providerCity,
      amount: statement.amount,
      referenceMonth: statement.referenceMonth,
      issuedOn: statement.issuedOn,
      link: statement.link,
      sourceFileName: fileName,
      source: "ML_DEMONSTRATIVO",
    };
  } catch {
    // NFS-e no modelo antigo da prefeitura ou no DANFSe do padrão nacional.
    const nfse = await parseBarueriNfsePdf(buffer).catch(() =>
      parseDanfseNacionalPdf(buffer).catch(() => {
        throw new Error(
          "PDF não reconhecido: não é demonstrativo do Mercado Livre, NFS-e de Barueri nem DANFSe do padrão nacional",
        );
      }),
    );
    return nfseToInvoice(nfse, fileName);
  }
}

function nfseToInvoice(nfse: ParsedNfse, fileName: string): Prisma.MlServiceInvoiceCreateManyInput {
  return {
    // O número da nota não se repete para o mesmo prestador.
    dedupeKey: `nfse-barueri|${nfse.providerDocument}|${nfse.documentNumber}`,
    providerName: nfse.providerName,
    providerDocument: nfse.providerDocument,
    providerCity: nfse.providerCity,
    amount: nfse.amount,
    referenceMonth: nfse.referenceMonth,
    issuedOn: nfse.issuedOn,
    link: null,
    sourceFileName: fileName,
    source: "NFSE",
    documentNumber: nfse.documentNumber,
    verificationCode: nfse.verificationCode,
    serviceCode: nfse.serviceCode,
    issAmount: nfse.issAmount,
    issRate: nfse.issRate,
  };
}

export type XmlFile = { name: string; content: string };

export type ImportMlServiceXmlResult = {
  newInvoices: number;
  existingInvoices: number;
  ignored: { reason: string; count: number; example: string }[];
};

export const mlServiceImportService = {
  /**
   * XML de NFS-e de Barueri (a J3 Envios, transportadora do Flex, cobra o frete
   * assim). Só entra nota em que a Holm é a tomadora e que não foi cancelada.
   */
  async importBarueriXmlFiles(files: XmlFile[]): Promise<ImportMlServiceXmlResult> {
    const byKey = new Map<string, Prisma.MlServiceInvoiceCreateManyInput>();
    const ignored = new Map<string, { count: number; example: string }>();
    const ignore = (reason: string, fileName: string) => {
      const entry = ignored.get(reason);
      if (entry) entry.count += 1;
      else ignored.set(reason, { count: 1, example: fileName });
    };

    for (const file of files) {
      const parsed = parseBarueriNfseXml(file.content);
      if (parsed.kind === "ignored") {
        ignore(parsed.reason, file.name);
        continue;
      }
      for (let i = 0; i < parsed.cancelled; i++) ignore("nota de serviço cancelada", file.name);
      for (const nfse of parsed.notes) {
        if (!COMPANY_DOCUMENTS.includes(nfse.recipientDocument)) {
          ignore("nota em que a Holm não é a tomadora do serviço", file.name);
          continue;
        }
        const invoice = nfseToInvoice(nfse, file.name);
        byKey.set(invoice.dedupeKey, invoice);
      }
    }

    const { newCount, existingCount } = await mlServiceInvoiceRepository.insertNew([...byKey.values()]);
    return {
      newInvoices: newCount,
      existingInvoices: existingCount,
      ignored: [...ignored].map(([reason, e]) => ({ reason, count: e.count, example: e.example })),
    };
  },

  /** Recebe os PDFs em base64 (o navegador abre o .zip). */
  async importPdfFiles(files: PdfFile[]): Promise<ImportMlServicesResult> {
    const byKey = new Map<string, Prisma.MlServiceInvoiceCreateManyInput>();
    const ignored = new Map<string, { count: number; example: string }>();

    for (const file of files) {
      try {
        const invoice = await toInvoice(Buffer.from(file.base64, "base64"), file.name);
        byKey.set(invoice.dedupeKey, invoice);
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        const reason = message || "PDF que não pôde ser lido";
        const entry = ignored.get(reason);
        if (entry) entry.count += 1;
        else ignored.set(reason, { count: 1, example: file.name });
      }
    }

    const { newCount, existingCount } = await mlServiceInvoiceRepository.insertNew([...byKey.values()]);
    return {
      files: files.length,
      newInvoices: newCount,
      existingInvoices: existingCount,
      ignored: [...ignored].map(([reason, e]) => ({ reason, count: e.count, example: e.example })),
    };
  },
};
