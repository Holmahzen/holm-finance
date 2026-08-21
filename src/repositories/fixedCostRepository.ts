import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export const fixedCostRepository = {
  findMany() {
    return prisma.fixedCost.findMany({
      include: { category: true, counterparty: true, creditCard: true },
      orderBy: { description: "asc" },
    });
  },

  findActive() {
    return prisma.fixedCost.findMany({ where: { isActive: true } });
  },

  findById(id: string) {
    return prisma.fixedCost.findUnique({ where: { id } });
  },

  create(data: Prisma.FixedCostUncheckedCreateInput) {
    return prisma.fixedCost.create({ data });
  },

  update(id: string, data: Prisma.FixedCostUncheckedUpdateInput) {
    return prisma.fixedCost.update({ where: { id }, data });
  },

  findEntryForMonth(fixedCostId: string, monthStart: Date, monthEnd: Date) {
    return prisma.entry.findFirst({
      where: { fixedCostId, dueDate: { gte: monthStart, lt: monthEnd } },
    });
  },

  /** Usada na geração: um custo fixo quinzenal/semanal gera mais de um lançamento por mês, então o dedup é por data exata, não só "existe algo nesse mês". */
  findEntryForDate(fixedCostId: string, dueDate: Date) {
    return prisma.entry.findFirst({ where: { fixedCostId, dueDate } });
  },

  unlinkEntries(fixedCostId: string) {
    return prisma.entry.updateMany({ where: { fixedCostId }, data: { fixedCostId: null } });
  },

  delete(id: string) {
    return prisma.fixedCost.delete({ where: { id } });
  },
};
