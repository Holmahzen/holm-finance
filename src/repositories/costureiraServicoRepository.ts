import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export const costureiraServicoRepository = {
  findOpenEntry(counterpartyId: string, categoryId: string) {
    return prisma.entry.findFirst({
      where: { counterpartyId, categoryId, status: "PENDING" },
    });
  },

  findByEntry(entryId: string) {
    return prisma.costureiraServico.findMany({
      where: { entryId },
      orderBy: { date: "asc" },
    });
  },

  findById(id: string) {
    return prisma.costureiraServico.findUnique({ where: { id } });
  },

  create(data: Prisma.CostureiraServicoUncheckedCreateInput) {
    return prisma.costureiraServico.create({ data });
  },

  delete(id: string) {
    return prisma.costureiraServico.delete({ where: { id } });
  },
};
