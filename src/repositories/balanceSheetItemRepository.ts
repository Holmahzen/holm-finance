import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export const balanceSheetItemRepository = {
  findMany() {
    return prisma.balanceSheetItem.findMany({ orderBy: { createdAt: "asc" } });
  },

  findActive() {
    return prisma.balanceSheetItem.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });
  },

  findById(id: string) {
    return prisma.balanceSheetItem.findUnique({ where: { id } });
  },

  create(data: Prisma.BalanceSheetItemUncheckedCreateInput) {
    return prisma.balanceSheetItem.create({ data });
  },

  update(id: string, data: Prisma.BalanceSheetItemUncheckedUpdateInput) {
    return prisma.balanceSheetItem.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.balanceSheetItem.delete({ where: { id } });
  },
};
