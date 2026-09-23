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

  // Todos os serviços cujo Entry ainda está pendente, de todas as
  // costureiras — base da visão agrupada (igual Cartão de Crédito).
  findAllPending(categoryId: string) {
    return prisma.costureiraServico.findMany({
      where: { entry: { categoryId, status: "PENDING" } },
      include: { counterparty: true, entry: true },
      orderBy: { date: "asc" },
    });
  },

  findSettledByCounterparty(counterpartyId: string, categoryId: string) {
    return prisma.costureiraServico.findMany({
      where: { counterpartyId, entry: { categoryId, status: "PAID" } },
      include: { entry: true },
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
};
