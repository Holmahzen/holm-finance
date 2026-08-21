import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export const creditCardPurchaseRepository = {
  findMany() {
    return prisma.creditCardPurchase.findMany({
      include: {
        creditCard: true,
        category: true,
        counterparty: true,
        generatedEntries: { orderBy: { installmentNumber: "asc" } },
      },
      orderBy: { purchaseDate: "desc" },
    });
  },

  findById(id: string) {
    return prisma.creditCardPurchase.findUnique({
      where: { id },
      include: { generatedEntries: true },
    });
  },

  create(data: Prisma.CreditCardPurchaseUncheckedCreateInput) {
    return prisma.creditCardPurchase.create({ data });
  },

  update(id: string, data: Prisma.CreditCardPurchaseUncheckedUpdateInput) {
    return prisma.creditCardPurchase.update({ where: { id }, data });
  },

  unlinkEntries(purchaseId: string) {
    return prisma.entry.updateMany({
      where: { creditCardPurchaseId: purchaseId },
      data: { creditCardPurchaseId: null },
    });
  },

  deleteUnpaidEntries(purchaseId: string) {
    return prisma.entry.deleteMany({
      where: { creditCardPurchaseId: purchaseId, status: "PENDING" },
    });
  },

  delete(id: string) {
    return prisma.creditCardPurchase.delete({ where: { id } });
  },
};
