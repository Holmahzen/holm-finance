import { prisma } from "@/lib/prisma";

export const mercadoLivreReceivableRepository = {
  findFirst() {
    return prisma.mercadoLivreReceivable.findFirst();
  },

  create() {
    return prisma.mercadoLivreReceivable.create({ data: {} });
  },

  update(id: string, data: { today?: string | number; tomorrow?: string | number; within7d?: string | number; after7d?: string | number }) {
    return prisma.mercadoLivreReceivable.update({ where: { id }, data });
  },
};
