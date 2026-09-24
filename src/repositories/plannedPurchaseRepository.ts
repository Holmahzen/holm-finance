import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export const plannedPurchaseRepository = {
  findMany() {
    return prisma.plannedPurchase.findMany({ orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }] });
  },

  findById(id: string) {
    return prisma.plannedPurchase.findUnique({ where: { id } });
  },

  create(data: Prisma.PlannedPurchaseUncheckedCreateInput) {
    return prisma.plannedPurchase.create({ data });
  },

  delete(id: string) {
    return prisma.plannedPurchase.delete({ where: { id } });
  },
};
