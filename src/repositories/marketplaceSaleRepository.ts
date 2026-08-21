import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export const marketplaceSaleRepository = {
  createMany(data: Prisma.MarketplaceSaleUncheckedCreateInput[], tx?: Prisma.TransactionClient) {
    return (tx ?? prisma).marketplaceSale.createMany({ data, skipDuplicates: true });
  },

  /**
   * Faz upsert por `orderId` em vez de só pular duplicados — assim,
   * reimportar um arquivo que já foi importado antes ATUALIZA os pedidos
   * existentes com os valores mais recentes da planilha (ex.: depois de uma
   * correção no parser, como `marketplaceCost`), em vez de ignorá-los.
   * Retorna quantos eram novos e quantos já existiam (e foram atualizados).
   */
  async upsertMany(data: Prisma.MarketplaceSaleUncheckedCreateInput[], tx?: Prisma.TransactionClient) {
    const client = tx ?? prisma;
    const orderIds = data.map((d) => d.orderId);
    const existing = await client.marketplaceSale.findMany({
      where: { orderId: { in: orderIds } },
      select: { orderId: true },
    });
    const existingIds = new Set(existing.map((e) => e.orderId));

    for (const row of data) {
      await client.marketplaceSale.upsert({
        where: { orderId: row.orderId },
        create: row,
        update: row,
      });
    }

    return { newCount: data.length - existingIds.size, updatedCount: existingIds.size };
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
        marketplaceCost: true,
        status: true,
        saleDate: true,
      },
    });
  },

  /** Nomes de comprador (com venda válida) no período — pra contar clientes únicos no CAC. */
  findCustomerNamesByPeriod(start: Date, end: Date) {
    return prisma.marketplaceSale.findMany({
      where: { saleDate: { gte: start, lt: end }, customerName: { not: null } },
      select: { customerName: true, status: true },
    });
  },
};
