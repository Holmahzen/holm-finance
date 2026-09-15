import { parseProductionServiceXml } from "@/parsers/nfse/productionServiceXmlParser";
import { parseBarueriNfsePdf } from "@/parsers/nfse/barueriNfseParser";
import { parseDanfseNacionalPdf } from "@/parsers/nfse/danfseNacionalParser";
import { guessServiceCategoryName, serviceInvoiceDedupeKey } from "@/domain/serviceInvoices";
import { COMPANY_DOCUMENTS } from "@/domain/fiscalNotes";
import { categoryRepository } from "@/repositories/categoryRepository";
import { serviceInvoiceRepository, type ServiceInvoiceToSave } from "@/repositories/serviceInvoiceRepository";

export type XmlFile = { name: string; content: string };
export type PdfFile = { name: string; base64: string };

export type ImportServiceInvoicesResult = {
  files: number;
  newInvoices: number;
  existingInvoices: number;
  /** Notas criadas mas sem categoria reconhecida — precisam de categorização manual em /entries. */
  uncategorized: number;
  ignored: { reason: string; count: number; example: string }[];
};

type Candidate = ServiceInvoiceToSave;

async function fromXml(content: string, fileName: string): Promise<Candidate | { ignored: string }> {
  const parsed = parseProductionServiceXml(content);
  if (parsed.kind === "ignored") return { ignored: parsed.reason };
  const { note } = parsed;

  if (!COMPANY_DOCUMENTS.includes(note.recipientDocument)) {
    return { ignored: "nota em que a Holm não é a tomadora do serviço" };
  }

  const categoryName = guessServiceCategoryName(note.serviceDescription, note.taxDescription);
  const category = categoryName ? await categoryRepository.findByName(categoryName) : null;

  return {
    dedupeKey: serviceInvoiceDedupeKey(note),
    providerDocument: note.providerDocument,
    providerName: note.providerName,
    recipientDocument: note.recipientDocument,
    recipientName: note.recipientName,
    serviceDescription: note.serviceDescription,
    amount: note.amount,
    issuedOn: note.issuedOn,
    referenceMonth: note.referenceMonth,
    documentNumber: note.documentNumber,
    sourceFileName: fileName,
    categoryId: category?.id ?? null,
  };
}

async function fromPdf(buffer: Buffer, fileName: string): Promise<Candidate | { ignored: string }> {
  const nfse = await parseBarueriNfsePdf(buffer).catch(() =>
    parseDanfseNacionalPdf(buffer).catch(() => null),
  );
  if (!nfse) {
    return { ignored: "PDF não reconhecido: não é NFS-e de Barueri nem DANFSe do padrão nacional" };
  }
  if (!COMPANY_DOCUMENTS.includes(nfse.recipientDocument)) {
    return { ignored: "nota em que a Holm não é a tomadora do serviço" };
  }

  const categoryName = guessServiceCategoryName(nfse.serviceDescription, "");
  const category = categoryName ? await categoryRepository.findByName(categoryName) : null;

  return {
    dedupeKey: serviceInvoiceDedupeKey({
      accessKey: nfse.verificationCode,
      providerDocument: nfse.providerDocument,
      documentNumber: nfse.documentNumber,
      issuedOn: nfse.issuedOn,
      amount: nfse.amount,
    }),
    providerDocument: nfse.providerDocument,
    providerName: nfse.providerName,
    recipientDocument: nfse.recipientDocument,
    recipientName: nfse.recipientName,
    serviceDescription: nfse.serviceDescription,
    amount: nfse.amount,
    issuedOn: nfse.issuedOn,
    referenceMonth: nfse.referenceMonth,
    documentNumber: nfse.documentNumber,
    sourceFileName: fileName,
    categoryId: category?.id ?? null,
  };
}

function isIgnored(c: Candidate | { ignored: string }): c is { ignored: string } {
  return "ignored" in c;
}

export const serviceInvoiceImportService = {
  async importFiles(xmlFiles: XmlFile[], pdfFiles: PdfFile[]): Promise<ImportServiceInvoicesResult> {
    const ignored = new Map<string, { count: number; example: string }>();
    const ignore = (reason: string, fileName: string) => {
      const entry = ignored.get(reason);
      if (entry) entry.count += 1;
      else ignored.set(reason, { count: 1, example: fileName });
    };

    const candidates = new Map<string, Candidate>();

    for (const file of xmlFiles) {
      const result = await fromXml(file.content, file.name);
      if (isIgnored(result)) ignore(result.ignored, file.name);
      else candidates.set(result.dedupeKey, result);
    }
    for (const file of pdfFiles) {
      const result = await fromPdf(Buffer.from(file.base64, "base64"), file.name);
      if (isIgnored(result)) ignore(result.ignored, file.name);
      else candidates.set(result.dedupeKey, result);
    }

    const list = [...candidates.values()];
    const existingKeys = await serviceInvoiceRepository.findExistingDedupeKeys(list.map((c) => c.dedupeKey));
    const toCreate = list.filter((c) => !existingKeys.has(c.dedupeKey));

    for (const note of toCreate) {
      await serviceInvoiceRepository.createWithEntry(note);
    }

    return {
      files: xmlFiles.length + pdfFiles.length,
      newInvoices: toCreate.length,
      existingInvoices: list.length - toCreate.length,
      uncategorized: toCreate.filter((c) => c.categoryId === null).length,
      ignored: [...ignored].map(([reason, e]) => ({ reason, count: e.count, example: e.example })),
    };
  },
};
