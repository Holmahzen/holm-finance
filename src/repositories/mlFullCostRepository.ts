import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export const mlFullCostRepository = {
  /** Upsert por costNumber (id único do ML, prefixado com o tipo) —
   * reimportar o mesmo relatório atualiza em vez de duplicar. */
  async upsertMany(rows: Prisma.MlFullCostUncheckedCreateInput[]) {
    let newCount = 0;
    let updatedCount = 0;
    for (const row of rows) {
      const key = { costNumber: row.costNumber };
      const existing = await prisma.mlFullCost.findUnique({ where: key });
      await prisma.mlFullCost.upsert({ where: key, create: row, update: row });
      if (existing) updatedCount++;
      else newCount++;
    }
    return { newCount, updatedCount };
  },

  /** Custos Full (coleta + armazenamento prolongado + retirada) por SKU, num período — só os tipos com SKU entram aqui. */
  findBySkusAndPeriod(skus: string[], start: Date, end: Date) {
    return prisma.mlFullCost.findMany({
      where: {
        sku: { in: skus },
        costDate: { gte: start, lt: end },
      },
    });
  },
};
