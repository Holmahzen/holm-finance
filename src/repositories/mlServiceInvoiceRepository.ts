import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { MlServiceRow } from "@/domain/mlServices";

export const mlServiceInvoiceRepository = {
  /** Grava só as notas que ainda não estão lá (a nota de serviço não muda depois de emitida). */
  async insertNew(data: Prisma.MlServiceInvoiceCreateManyInput[]) {
    const existing = await prisma.mlServiceInvoice.findMany({
      where: { dedupeKey: { in: data.map((d) => d.dedupeKey) } },
      select: { dedupeKey: true },
    });
    const known = new Set(existing.map((e) => e.dedupeKey));
    const fresh = data.filter((d) => !known.has(d.dedupeKey));
    if (fresh.length > 0) {
      await prisma.mlServiceInvoice.createMany({ data: fresh, skipDuplicates: true });
    }
    return { newCount: fresh.length, existingCount: data.length - fresh.length };
  },

  async findSince(fromMonth: string): Promise<MlServiceRow[]> {
    const rows = await prisma.mlServiceInvoice.findMany({
      where: { referenceMonth: { gte: fromMonth } },
      orderBy: { amount: "desc" },
    });
    return rows.map((r) => ({
      referenceMonth: r.referenceMonth,
      providerName: r.providerName,
      providerDocument: r.providerDocument,
      providerCity: r.providerCity,
      amount: Number(r.amount),
      issuedOn: r.issuedOn.toISOString().slice(0, 10),
      link: r.link,
      source: r.source,
      documentNumber: r.documentNumber,
    }));
  },
};
