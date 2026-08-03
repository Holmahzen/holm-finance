import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export const marketplaceSaleRepository = {
  createMany(data: Prisma.MarketplaceSaleUncheckedCreateInput[], tx?: Prisma.TransactionClient) {
    return (tx ?? prisma).marketplaceSale.createMany({ data, skipDuplicates: true });
  },

  findByPeriod(start: Date, end: Date) {
    return prisma.marketplaceSale.findMany({
      where: { saleDate: { gte: start, lt: end } },
      orderBy: { saleDate: "desc" },
    });
  },

  findAllForAggregation() {
    return prisma.marketplaceSale.findMany({
      select: {
        sku: true,
        productName: true,
        quantity: true,
        grossRevenue: true,
        netRevenue: true,
        status: true,
        saleDate: true,
      },
    });
  },
};
