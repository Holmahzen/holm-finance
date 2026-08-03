import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export const importBatchRepository = {
  findByHash(bankAccountId: string, fileHash: string) {
    return prisma.importBatch.findUnique({
      where: { bankAccountId_fileHash: { bankAccountId, fileHash } },
    });
  },

  findLatestByAccount(bankAccountId: string) {
    return prisma.importBatch.findFirst({
      where: { bankAccountId },
      orderBy: [{ ledgerBalanceDate: "desc" }, { importedAt: "desc" }],
    });
  },

  findMany() {
    return prisma.importBatch.findMany({
      include: { bankAccount: true },
      orderBy: { importedAt: "desc" },
    });
  },

  create(data: Prisma.ImportBatchUncheckedCreateInput, tx?: Prisma.TransactionClient) {
    return (tx ?? prisma).importBatch.create({ data });
  },
};
