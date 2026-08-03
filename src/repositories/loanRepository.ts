import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export const loanRepository = {
  findMany() {
    return prisma.loan.findMany({ include: { category: true }, orderBy: { description: "asc" } });
  },

  findActive() {
    return prisma.loan.findMany({ where: { isActive: true } });
  },

  findById(id: string) {
    return prisma.loan.findUnique({ where: { id } });
  },

  create(data: Prisma.LoanUncheckedCreateInput) {
    return prisma.loan.create({ data, include: { category: true } });
  },

  update(id: string, data: Prisma.LoanUncheckedUpdateInput) {
    return prisma.loan.update({ where: { id }, data, include: { category: true } });
  },

  delete(id: string) {
    return prisma.loan.delete({ where: { id } });
  },

  /** Todas as parcelas já pagas que batem com o texto de identificação do empréstimo, da mais antiga pra mais nova. */
  findPaidPayments(matchText: string) {
    return prisma.entry.findMany({
      where: { type: "PAYABLE", status: "PAID", description: { contains: matchText } },
      orderBy: { paidAt: "asc" },
      select: { id: true, paidAmount: true, paidAt: true },
    });
  },
};
