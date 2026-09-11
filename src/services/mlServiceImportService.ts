import type { Prisma } from "@/generated/prisma/client";
import { parseMlServiceStatementPdf } from "@/parsers/nfse/mlServiceStatementParser";
import { mlServiceDedupeKey } from "@/domain/mlServices";
import { mlServiceInvoiceRepository } from "@/repositories/mlServiceInvoiceRepository";

export type PdfFile = { name: string; base64: string };

export type ImportMlServicesResult = {
  files: number;
  newInvoices: number;
  existingInvoices: number;
  ignored: { reason: string; count: number; example: string }[];
};

export const mlServiceImportService = {
  /** Recebe os PDFs "Demonstrativo de Nota Fiscal" do ML em base64 (o navegador abre o .zip). */
  async importPdfFiles(files: PdfFile[]): Promise<ImportMlServicesResult> {
    const byKey = new Map<string, Prisma.MlServiceInvoiceCreateManyInput>();
    const ignored = new Map<string, { count: number; example: string }>();

    for (const file of files) {
      try {
        const s = await parseMlServiceStatementPdf(Buffer.from(file.base64, "base64"));
        const dedupeKey = mlServiceDedupeKey(s, file.name);
        byKey.set(dedupeKey, {
          dedupeKey,
          providerName: s.providerName,
          providerDocument: s.providerDocument,
          providerCity: s.providerCity,
          amount: s.amount,
          referenceMonth: s.referenceMonth,
          issuedOn: s.issuedOn,
          link: s.link,
          sourceFileName: file.name,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        const reason = message.startsWith("não é um demonstrativo") || message.startsWith("demonstrativo sem")
          ? message
          : "PDF que não pôde ser lido";
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
