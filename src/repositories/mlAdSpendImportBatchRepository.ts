import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export const mlAdSpendImportBatchRepository = {
  findByHash(fileHash: string) {
    return prisma.mlAdSpendImportBatch.findUnique({ where: { fileHash } });
  },

  create(data: Prisma.MlAdSpendImportBatchUncheckedCreateInput, tx?: Prisma.TransactionClient) {
    return (tx ?? prisma).mlAdSpendImportBatch.create({ data });
  },

  updateCounts(
    id: string,
    counts: { importedCount: number; duplicateCount: number },
    tx?: Prisma.TransactionClient,
  ) {
    return (tx ?? prisma).mlAdSpendImportBatch.update({ where: { id }, data: counts });
  },

  findMany() {
    return prisma.mlAdSpendImportBatch.findMany({ orderBy: { importedAt: "desc" } });
  },
};
