import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export const counterpartyRepository = {
  findMany() {
    return prisma.counterparty.findMany({ orderBy: { name: "asc" } });
  },

  findById(id: string) {
    return prisma.counterparty.findUnique({ where: { id } });
  },

  findByDocument(document: string) {
    return prisma.counterparty.findUnique({ where: { document } });
  },

  create(data: Prisma.CounterpartyUncheckedCreateInput) {
    return prisma.counterparty.create({ data });
  },

  update(id: string, data: Prisma.CounterpartyUncheckedUpdateInput) {
    return prisma.counterparty.update({ where: { id }, data });
  },
};
