import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export const reconciliationMatchRepository = {
  findMany(where?: Prisma.ReconciliationMatchWhereInput) {
    return prisma.reconciliationMatch.findMany({
      where,
      include: {
        importedTransaction: true,
        entry: { include: { category: true, counterparty: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  findById(id: string) {
    return prisma.reconciliationMatch.findUnique({
      where: { id },
      include: { importedTransaction: true, entry: true },
    });
  },

  upsertSuggested(
    importedTransactionId: string,
    entryId: string,
    matchScore: number,
    matchReasons: string[],
  ) {
    return prisma.reconciliationMatch.upsert({
      where: { importedTransactionId },
      create: {
        importedTransactionId,
        entryId,
        matchScore,
        matchReasons,
        status: "SUGGESTED",
      },
      update: { entryId, matchScore, matchReasons, status: "SUGGESTED" },
    });
  },

  update(id: string, data: Prisma.ReconciliationMatchUncheckedUpdateInput) {
    return prisma.reconciliationMatch.update({ where: { id }, data });
  },

  findUnmatchedEntries(type?: "PAYABLE" | "RECEIVABLE") {
    return prisma.entry.findMany({
      where: {
        status: "PENDING",
        reconciliationMatch: null,
        ...(type ? { type } : {}),
      },
      include: { counterparty: true },
    });
  },

  findUnmatchedTransactions() {
    return prisma.importedTransaction.findMany({
      where: {
        OR: [{ reconciliationMatch: null }, { reconciliationMatch: { status: "REJECTED" } }],
      },
      include: { bankAccount: true },
      orderBy: { postedAt: "asc" },
    });
  },
};
