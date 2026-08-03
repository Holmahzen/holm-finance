import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export const accountRepository = {
  findMany() {
    return prisma.financialAccount.findMany({
      orderBy: { createdAt: "asc" },
    });
  },

  findById(id: string) {
    return prisma.financialAccount.findUnique({ where: { id } });
  },

  create(data: Prisma.FinancialAccountCreateInput) {
    return prisma.financialAccount.create({ data });
  },

  update(id: string, data: Prisma.FinancialAccountUpdateInput) {
    return prisma.financialAccount.update({ where: { id }, data });
  },

  async countUsage(id: string) {
    const [entries, importBatches, importedTransactions] = await Promise.all([
      prisma.entry.count({ where: { bankAccountId: id } }),
      prisma.importBatch.count({ where: { bankAccountId: id } }),
      prisma.importedTransaction.count({ where: { bankAccountId: id } }),
    ]);
    return entries + importBatches + importedTransactions;
  },

  delete(id: string) {
    return prisma.financialAccount.delete({ where: { id } });
  },
};
