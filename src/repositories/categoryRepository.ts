import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export const categoryRepository = {
  findMany() {
    return prisma.category.findMany({ orderBy: { name: "asc" } });
  },

  findById(id: string) {
    return prisma.category.findUnique({ where: { id } });
  },

  create(data: Prisma.CategoryUncheckedCreateInput) {
    return prisma.category.create({ data });
  },

  update(id: string, data: Prisma.CategoryUncheckedUpdateInput) {
    return prisma.category.update({ where: { id }, data });
  },
};
