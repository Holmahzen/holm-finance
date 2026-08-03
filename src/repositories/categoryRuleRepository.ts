import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export const categoryRuleRepository = {
  findMany() {
    return prisma.categoryRule.findMany({
      include: { category: true },
      orderBy: { createdAt: "desc" },
    });
  },

  create(data: Prisma.CategoryRuleUncheckedCreateInput) {
    return prisma.categoryRule.create({ data, include: { category: true } });
  },

  delete(id: string) {
    return prisma.categoryRule.delete({ where: { id } });
  },
};
