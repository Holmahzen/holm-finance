import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export type ServiceInvoiceToSave = {
  dedupeKey: string;
  providerDocument: string;
  providerName: string;
  recipientDocument: string;
  recipientName: string;
  serviceDescription: string;
  amount: number;
  issuedOn: Date;
  referenceMonth: string;
  documentNumber: string;
  sourceFileName: string;
  categoryId: string | null;
};

export const serviceInvoiceRepository = {
  async findExistingDedupeKeys(keys: string[]): Promise<Set<string>> {
    const rows = await prisma.serviceInvoice.findMany({
      where: { dedupeKey: { in: keys } },
      select: { dedupeKey: true },
    });
    return new Set(rows.map((r) => r.dedupeKey));
  },

  /** Cria o Entry pago e a ServiceInvoice vinculada numa transação só. */
  async createWithEntry(note: ServiceInvoiceToSave, tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma;
    const competenceDate = new Date(`${note.referenceMonth}-01T00:00:00.000Z`);

    const entry = await client.entry.create({
      data: {
        type: "PAYABLE",
        description: note.serviceDescription
          ? `${note.serviceDescription} — ${note.providerName}`
          : note.providerName,
        amount: note.amount,
        dueDate: note.issuedOn,
        competenceDate,
        status: "PAID",
        paidAt: note.issuedOn,
        paidAmount: note.amount,
        categoryId: note.categoryId,
        notes: "Importado de nota de serviço de produção (prestador terceiro).",
      },
    });

    return client.serviceInvoice.create({
      data: {
        dedupeKey: note.dedupeKey,
        providerDocument: note.providerDocument,
        providerName: note.providerName,
        recipientDocument: note.recipientDocument,
        recipientName: note.recipientName,
        serviceDescription: note.serviceDescription,
        amount: note.amount,
        issuedOn: note.issuedOn,
        referenceMonth: note.referenceMonth,
        documentNumber: note.documentNumber,
        sourceFileName: note.sourceFileName,
        entryId: entry.id,
      },
    });
  },

  findMany() {
    return prisma.serviceInvoice.findMany({
      include: { entry: { select: { category: { select: { name: true } } } } },
      orderBy: { issuedOn: "desc" },
    });
  },

  lastImportedAt() {
    return prisma.serviceInvoice
      .findFirst({ orderBy: { importedAt: "desc" }, select: { importedAt: true } })
      .then((r) => r?.importedAt ?? null);
  },
};
