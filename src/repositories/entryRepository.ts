import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

const creditCardIncludes = {
  fixedCost: { select: { creditCard: { select: { id: true, name: true } } } },
  creditCardPurchase: { select: { creditCard: { select: { id: true, name: true } } } },
} as const;

export const entryRepository = {
  findMany(where?: Prisma.EntryWhereInput) {
    return prisma.entry.findMany({
      where,
      include: { category: true, counterparty: true, bankAccount: true, ...creditCardIncludes },
      orderBy: { dueDate: "asc" },
    });
  },

  findById(id: string) {
    return prisma.entry.findUnique({
      where: { id },
      include: { category: true, counterparty: true, bankAccount: true, ...creditCardIncludes },
    });
  },

  create(data: Prisma.EntryUncheckedCreateInput) {
    return prisma.entry.create({ data });
  },

  update(id: string, data: Prisma.EntryUncheckedUpdateInput) {
    return prisma.entry.update({ where: { id }, data });
  },

  deleteReconciliationMatchForEntry(id: string) {
    return prisma.reconciliationMatch.deleteMany({ where: { entryId: id } });
  },

  delete(id: string) {
    return prisma.entry.delete({ where: { id } });
  },
};
