import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export const mlFullCostImportBatchRepository = {
  findByHash(fileHash: string) {
    return prisma.mlFullCostImportBatch.findUnique({ where: { fileHash } });
  },

  create(data: Prisma.MlFullCostImportBatchUncheckedCreateInput, tx?: Prisma.TransactionClient) {
    return (tx ?? prisma).mlFullCostImportBatch.create({ data });
  },

  updateCounts(
    id: string,
    counts: { importedCount: number; duplicateCount: number },
    tx?: Prisma.TransactionClient,
  ) {
    return (tx ?? prisma).mlFullCostImportBatch.update({ where: { id }, data: counts });
  },

  findMany() {
    return prisma.mlFullCostImportBatch.findMany({ orderBy: { importedAt: "desc" } });
  },
};
