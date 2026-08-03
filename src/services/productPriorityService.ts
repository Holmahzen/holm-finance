import { marketplaceSaleRepository } from "@/repositories/marketplaceSaleRepository";
import { productRepository } from "@/repositories/productRepository";
import { aggregateSalesBySku } from "@/domain/salesAggregation";
import { rankUncostedProducts } from "@/domain/productPriority";

export const productPriorityService = {
  async getUncostedSkus(year: number, month: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const [sales, costedSkus] = await Promise.all([
      marketplaceSaleRepository.findByPeriod(start, end),
      productRepository.findCostedSkus(),
    ]);

    const skuAggregates = aggregateSalesBySku(
      sales.map((s) => ({
        sku: s.sku,
        productName: s.productName,
        quantity: s.quantity,
        grossRevenue: Number(s.grossRevenue),
        netRevenue: Number(s.netRevenue),
        status: s.status,
      })),
    );

    return rankUncostedProducts(skuAggregates, new Set(costedSkus));
  },
};
