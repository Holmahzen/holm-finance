import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export const salesImportBatchRepository = {
  findByHash(fileHash: string) {
    return prisma.salesImportBatch.findUnique({ where: { fileHash } });
  },

  create(data: Prisma.SalesImportBatchUncheckedCreateInput, tx?: Prisma.TransactionClient) {
    return (tx ?? prisma).salesImportBatch.create({ data });
  },

  updateCounts(
    id: string,
    counts: { importedCount: number; duplicateCount: number },
    tx?: Prisma.TransactionClient,
  ) {
    return (tx ?? prisma).salesImportBatch.update({ where: { id }, data: counts });
  },

  findMany() {
    return prisma.salesImportBatch.findMany({ orderBy: { importedAt: "desc" } });
  },
};
