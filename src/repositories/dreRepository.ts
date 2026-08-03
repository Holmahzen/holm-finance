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

  async getCategoryTotals(start: Date, end: Date) {
    const [categories, payableSums, receivableSums] = await Promise.all([
      prisma.category.findMany({
        where: { dreGroup: { not: null } },
        select: { id: true, name: true, dreGroup: true },
      }),
      prisma.entry.groupBy({
        by: ["categoryId"],
        where: {
          status: "PAID",
          paidAt: { gte: start, lt: end },
          categoryId: { not: null },
          type: "PAYABLE",
        },
        _sum: { paidAmount: true },
      }),
      prisma.entry.groupBy({
        by: ["categoryId"],
        where: {
          status: "PAID",
          paidAt: { gte: start, lt: end },
          categoryId: { not: null },
          type: "RECEIVABLE",
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
