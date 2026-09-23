import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export const costureiraServicoRepository = {
  findPending(counterpartyId: string) {
    return prisma.costureiraServico.findMany({
      where: { counterpartyId, paidEntryId: null },
      orderBy: { date: "asc" },
    });
  },

  findSettled(counterpartyId: string) {
    return prisma.costureiraServico.findMany({
      where: { counterpartyId, paidEntryId: { not: null } },
      orderBy: { date: "desc" },
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

  markPaid(ids: string[], paidEntryId: string) {
    return prisma.costureiraServico.updateMany({ where: { id: { in: ids } }, data: { paidEntryId } });
  },
};
