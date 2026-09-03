import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

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

    // Traz todos os lançamentos pagos com data, em vez de já agregar por conta:
    // uma conta com extrato importado só deve somar o que foi pago DEPOIS da
    // data daquele extrato, pra não contar de novo o que o extrato já reflete.
    // Lançamentos com vínculo de conciliação (reconciliationMatch) correspondem
    // a uma transação que já veio de um extrato importado — o saldo do extrato
    // já inclui esse valor, então eles NUNCA entram na soma "desde o extrato",
    // senão o valor é contado duas vezes.
    const paidEntries = await prisma.entry.findMany({
      where: { status: "PAID", bankAccountId: { not: null } },
      select: {
        bankAccountId: true,
        type: true,
        paidAmount: true,
        paidAt: true,
        reconciliationMatch: { select: { id: true } },
      },
    });

    return accounts.map((account) => {
      const latestBatch = account.importBatches[0];
      const entriesForAccount = paidEntries.filter((e) => e.bankAccountId === account.id);

      if (latestBatch?.ledgerBalance) {
        const cutoff = latestBatch.ledgerBalanceDate;
        const sumSince = (type: "RECEIVABLE" | "PAYABLE") =>
          entriesForAccount
            .filter(
              (e) =>
                e.type === type && !e.reconciliationMatch && cutoff && e.paidAt && e.paidAt > cutoff,
            )
            .reduce((acc, e) => acc.add(e.paidAmount ?? 0), new Prisma.Decimal(0));

        const balance = latestBatch.ledgerBalance.add(sumSince("RECEIVABLE")).sub(sumSince("PAYABLE"));
        return { id: account.id, name: account.name, balance };
      }

      const sumAll = (type: "RECEIVABLE" | "PAYABLE") =>
        entriesForAccount
          .filter((e) => e.type === type)
          .reduce((acc, e) => acc.add(e.paidAmount ?? 0), new Prisma.Decimal(0));

      return {
        id: account.id,
        name: account.name,
        balance: account.openingBalance.add(sumAll("RECEIVABLE")).sub(sumAll("PAYABLE")),
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

  /** Mesma ideia de `getByCategory`, mas pra tudo que ainda está PENDENTE (sem recorte de período) — usado no Balanço Patrimonial pra detalhar Contas a Pagar/Receber. */
  async getPendingByCategory(type: "PAYABLE" | "RECEIVABLE") {
    const grouped = await prisma.entry.groupBy({
      by: ["categoryId"],
      where: { type, status: "PENDING" },
      _sum: { amount: true },
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
        total: g._sum.amount ?? 0,
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
