import { prisma } from "@/lib/prisma";
import { DRE_GROUP_ENTRY_TYPE } from "@/domain/dre";
import { isExcludedSaleStatus } from "@/domain/salesAggregation";

export const dreRepository = {
  async getSoldQuantitiesBySku(start: Date, end: Date) {
    const sales = await prisma.marketplaceSale.findMany({
      where: { saleDate: { gte: start, lt: end } },
      select: { sku: true, quantity: true, status: true },
    });
    return sales
      .filter((s) => !isExcludedSaleStatus(s.status))
      .map((s) => ({ sku: s.sku, quantity: s.quantity }));
  },

  /** Soma de lançamentos pagos no período em categorias marcadas como publicidade/anúncio — usada pro CAC. */
  async getAdvertisingSpend(start: Date, end: Date) {
    const result = await prisma.entry.aggregate({
      where: {
        status: "PAID",
        paidAt: { gte: start, lt: end },
        type: "PAYABLE",
        category: { isAdvertising: true },
      },
      _sum: { paidAmount: true },
    });
    return Number(result._sum.paidAmount ?? 0);
  },

  async getCategoryTotals(start: Date, end: Date) {
    // Entra no período pela data de competência quando ela foi informada
    // (ex.: cada compra de uma fatura de cartão, lançada com a data em que
    // a compra foi feita) — sem competência, cai no comportamento de sempre
    // (data de pagamento), pra não quebrar lançamentos já existentes.
    const periodWhere = {
      OR: [
        { competenceDate: { gte: start, lt: end } },
        { competenceDate: null, paidAt: { gte: start, lt: end } },
      ],
    };

    const [categories, payableSums, receivableSums] = await Promise.all([
      prisma.category.findMany({
        where: { dreGroup: { not: null } },
        select: { id: true, name: true, dreGroup: true },
      }),
      prisma.entry.groupBy({
        by: ["categoryId"],
        where: {
          status: "PAID",
          categoryId: { not: null },
          type: "PAYABLE",
          ...periodWhere,
        },
        _sum: { paidAmount: true },
      }),
      prisma.entry.groupBy({
        by: ["categoryId"],
        where: {
          status: "PAID",
          categoryId: { not: null },
          type: "RECEIVABLE",
          ...periodWhere,
        },
        _sum: { paidAmount: true },
      }),
    ]);

    const payableByCategoryId = new Map(
      payableSums.map((s) => [s.categoryId, Number(s._sum.paidAmount ?? 0)]),
    );
    const receivableByCategoryId = new Map(
      receivableSums.map((s) => [s.categoryId, Number(s._sum.paidAmount ?? 0)]),
    );

    return categories.map((c) => {
      const group = c.dreGroup!;
      const expectedType = DRE_GROUP_ENTRY_TYPE[group];
      const sumMap = expectedType === "PAYABLE" ? payableByCategoryId : receivableByCategoryId;
      return {
        categoryId: c.id,
        name: c.name,
        dreGroup: group,
        total: sumMap.get(c.id) ?? 0,
      };
    });
  },
};
