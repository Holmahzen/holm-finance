import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export const productRepository = {
  findMany() {
    return prisma.product.findMany({ orderBy: { name: "asc" } });
  },

  findActive() {
    return prisma.product.findMany({ where: { isActive: true } });
  },

  findById(id: string) {
    return prisma.product.findUnique({ where: { id } });
  },

  findBySku(sku: string) {
    return prisma.product.findUnique({ where: { sku } });
  },

  create(data: Prisma.ProductUncheckedCreateInput) {
    return prisma.product.create({ data });
  },

  update(id: string, data: Prisma.ProductUncheckedUpdateInput) {
    return prisma.product.update({ where: { id }, data });
  },

  /** SKUs que já têm ao menos um custo de peça (tecido/costura/aviamentos) cadastrado. */
  async findCostedSkus() {
    const products = await prisma.product.findMany({
      where: {
        sku: { not: null },
        OR: [{ tecidoCost: { gt: 0 } }, { costuraCost: { gt: 0 } }, { aviamentosCost: { gt: 0 } }],
      },
      select: { sku: true },
    });
    return products.map((p) => p.sku!);
  },

  async getProductCostsBySku() {
    const products = await prisma.product.findMany({
      where: { sku: { not: null }, isActive: true },
      select: { sku: true, tecidoCost: true, costuraCost: true, aviamentosCost: true },
    });
    return products.map((p) => ({
      sku: p.sku!,
      tecidoCost: Number(p.tecidoCost),
      costuraCost: Number(p.costuraCost),
      aviamentosCost: Number(p.aviamentosCost),
    }));
  },
};
