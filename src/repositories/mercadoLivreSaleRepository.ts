import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export const mercadoLivreSaleRepository = {
  /**
   * Upsert por número do pedido: reimportar o relatório atualizado corrige as
   * vendas que já estavam lá (uma entrega que aconteceu depois da exportação
   * anterior, por exemplo) em vez de duplicá-las ou ignorá-las.
   */
  async upsertMany(
    data: Prisma.MercadoLivreSaleUncheckedCreateInput[],
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? prisma;
    const existing = await client.mercadoLivreSale.findMany({
      where: { orderId: { in: data.map((d) => d.orderId) } },
      select: { orderId: true },
    });
    const existingIds = new Set(existing.map((e) => e.orderId));

    for (const row of data) {
      await client.mercadoLivreSale.upsert({
        where: { orderId: row.orderId },
        create: row,
        update: row,
      });
    }

    return { newCount: data.length - existingIds.size, updatedCount: existingIds.size };
  },

  /** Base do calendário de repasses: tudo que o export nativo trouxe. */
  findAllForSchedule() {
    return prisma.mercadoLivreSale.findMany({
      select: { status: true, netTotal: true, deliveredAt: true },
    });
  },

  count() {
    return prisma.mercadoLivreSale.count();
  },

  countWithDeliveryDate() {
    return prisma.mercadoLivreSale.count({ where: { deliveredAt: { not: null } } });
  },

  /** Data e período da última importação, pra tela dizer de quando é o retrato. */
  async getImportSummary() {
    const aggregate = await prisma.mercadoLivreSale.aggregate({
      _max: { importedAt: true, saleDate: true },
      _min: { saleDate: true },
    });
    return {
      lastImportedAt: aggregate._max.importedAt,
      firstSaleDate: aggregate._min.saleDate,
      lastSaleDate: aggregate._max.saleDate,
    };
  },
};
