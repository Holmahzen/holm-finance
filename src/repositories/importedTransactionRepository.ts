import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export const importedTransactionRepository = {
  createMany(
    data: Prisma.ImportedTransactionUncheckedCreateInput[],
    tx?: Prisma.TransactionClient,
  ) {
    return (tx ?? prisma).importedTransaction.createMany({
      data,
      skipDuplicates: true,
    });
  },

  findByAccount(bankAccountId: string) {
    return prisma.importedTransaction.findMany({
      where: { bankAccountId },
      orderBy: { postedAt: "desc" },
    });
  },
};
