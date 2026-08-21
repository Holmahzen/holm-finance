import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export const creditCardRepository = {
  findMany() {
    return prisma.creditCard.findMany({ orderBy: { name: "asc" } });
  },

  findActive() {
    return prisma.creditCard.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  },

  findById(id: string) {
    return prisma.creditCard.findUnique({ where: { id } });
  },

  create(data: Prisma.CreditCardUncheckedCreateInput) {
    return prisma.creditCard.create({ data });
  },

  update(id: string, data: Prisma.CreditCardUncheckedUpdateInput) {
    return prisma.creditCard.update({ where: { id }, data });
  },
};
