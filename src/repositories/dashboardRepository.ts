import { prisma } from "@/lib/prisma";

export const dashboardRepository = {
  async getAccountBalances() {
    const accounts = await prisma.financialAccount.findMany({
      where: { isActive: true },
      include: {
        importBatches: {
          where: { ledgerBalance: { not: null } },
          orderBy: [{ ledgerBalanceDate: "desc" }, { importedAt: "desc" }],
          take: 1,
        },
      },
    });

    const paidSums = await prisma.entry.groupBy({
      by: ["bankAccountId", "type"],
      where: { status: "PAID", bankAccountId: { not: null } },
      _sum: { paidAmount: true },
    });

    return accounts.map((account) => {
      const latestBatch = account.importBatches[0];
      if (latestBatch?.ledgerBalance) {
        return { id: account.id, name: account.name, balance: latestBatch.ledgerBalance };
      }

      const paidIn =
        paidSums.find((s) => s.bankAccountId === account.id && s.type === "RECEIVABLE")?._sum
          .paidAmount ?? 0;
      const paidOut =
        paidSums.find((s) => s.bankAccountId === account.id && s.type === "PAYABLE")?._sum
          .paidAmount ?? 0;

      return {
        id: account.id,
        name: account.name,
        balance: account.openingBalance.add(paidIn).sub(paidOut),
      };
    });
  },

  async getPendingEntriesSummary() {
    const now = new Date();

    const [payablePending, payableOverdue, receivablePending, receivableOverdue] =
      await Promise.all([
        prisma.entry.aggregate({
          where: { type: "PAYABLE", status: "PENDING" },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.entry.aggregate({
          where: { type: "PAYABLE", status: "PENDING", dueDate: { lt: now } },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.entry.aggregate({
          where: { type: "RECEIVABLE", status: "PENDING" },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.entry.aggregate({
          where: { type: "RECEIVABLE", status: "PENDING", dueDate: { lt: now } },
          _sum: { amount: true },
          _count: true,
        }),
      ]);

    return {
      payable: {
        count: payablePending._count,
        total: payablePending._sum.amount ?? 0,
        overdueCount: payableOverdue._count,
        overdueTotal: payableOverdue._sum.amount ?? 0,
      },
      receivable: {
        count: receivablePending._count,
        total: receivablePending._sum.amount ?? 0,
        overdueCount: receivableOverdue._count,
        overdueTotal: receivableOverdue._sum.amount ?? 0,
      },
    };
  },

  async getReconciliationCounts() {
    const [suggestedCount, unmatchedCount] = await Promise.all([
      prisma.reconciliationMatch.count({ where: { status: "SUGGESTED" } }),
      prisma.importedTransaction.count({
        where: {
          OR: [{ reconciliationMatch: null }, { reconciliationMatch: { status: "REJECTED" } }],
        },
      }),
    ]);
    return { suggestedCount, unmatchedCount };
  },

  async getMonthlyFlow(start: Date, end: Date) {
    const [inflow, outflow] = await Promise.all([
      prisma.entry.aggregate({
        where: { type: "RECEIVABLE", status: "PAID", paidAt: { gte: start, lt: end } },
        _sum: { paidAmount: true },
      }),
      prisma.entry.aggregate({
        where: { type: "PAYABLE", status: "PAID", paidAt: { gte: start, lt: end } },
        _sum: { paidAmount: true },
      }),
    ]);

    return {
      inflow: inflow._sum.paidAmount ?? 0,
      outflow: outflow._sum.paidAmount ?? 0,
    };
  },

  async getByCategory(type: "PAYABLE" | "RECEIVABLE", start: Date, end: Date) {
    const grouped = await prisma.entry.groupBy({
      by: ["categoryId"],
      where: { type, status: "PAID", paidAt: { gte: start, lt: end } },
      _sum: { paidAmount: true },
    });

    const categoryIds = grouped.map((g) => g.categoryId).filter((id): id is string => !!id);
    const categories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    });
    const nameById = new Map(categories.map((c) => [c.id, c.name]));

    return grouped
      .map((g) => ({
        name: g.categoryId ? (nameById.get(g.categoryId) ?? "—") : "Sem categoria",
        total: g._sum.paidAmount ?? 0,
      }))
      .sort((a, b) => Number(b.total) - Number(a.total));
  },

  async getTopCounterparties(
    type: "PAYABLE" | "RECEIVABLE",
    start: Date,
    end: Date,
    limit: number,
  ) {
    const grouped = await prisma.entry.groupBy({
      by: ["counterpartyId"],
      where: { type, status: "PAID", paidAt: { gte: start, lt: end } },
      _sum: { paidAmount: true },
    });

    const ids = grouped.map((g) => g.counterpartyId).filter((id): id is string => !!id);
    const counterparties = await prisma.counterparty.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
    const nameById = new Map(counterparties.map((c) => [c.id, c.name]));

    return grouped
      .map((g) => ({
        name: g.counterpartyId ? (nameById.get(g.counterpartyId) ?? "—") : "Sem contraparte",
        total: g._sum.paidAmount ?? 0,
      }))
      .sort((a, b) => Number(b.total) - Number(a.total))
      .slice(0, limit);
  },
};
