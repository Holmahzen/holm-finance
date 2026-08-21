import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export const reserveDepositRepository = {
  findMany() {
    return prisma.reserveDeposit.findMany({ orderBy: { date: "desc" } });
  },

  findById(id: string) {
    return prisma.reserveDeposit.findUnique({ where: { id } });
  },

  create(data: Prisma.ReserveDepositUncheckedCreateInput) {
    return prisma.reserveDeposit.create({ data });
  },

  delete(id: string) {
    return prisma.reserveDeposit.delete({ where: { id } });
  },
};
