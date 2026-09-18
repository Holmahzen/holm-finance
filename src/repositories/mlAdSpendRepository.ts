import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export const mlAdSpendRepository = {
  /** Upsert pela chave natural do relatório (anúncio + campanha + período) —
   * reimportar o mesmo arquivo, ou um período que se sobrepõe, atualiza em
   * vez de duplicar. */
  async upsertMany(rows: Prisma.MlAdSpendUncheckedCreateInput[]) {
    let newCount = 0;
    let updatedCount = 0;
    for (const row of rows) {
      const key = {
        listingCode_campaignName_periodStart_periodEnd: {
          listingCode: row.listingCode,
          campaignName: row.campaignName,
          periodStart: row.periodStart,
          periodEnd: row.periodEnd,
        },
      };
      const existing = await prisma.mlAdSpend.findUnique({ where: key });
      await prisma.mlAdSpend.upsert({ where: key, create: row, update: row });
      if (existing) updatedCount++;
      else newCount++;
    }
    return { newCount, updatedCount };
  },

  /** Investimento total por código de anúncio, num intervalo de datas —
   * soma todas as campanhas/sub-períodos que caem (mesmo que parcialmente)
   * dentro do intervalo pedido. */
  findByListingCodesAndPeriod(listingCodes: string[], start: Date, end: Date) {
    return prisma.mlAdSpend.findMany({
      where: {
        listingCode: { in: listingCodes },
        periodStart: { lt: end },
        periodEnd: { gte: start },
      },
    });
  },
};
