import { marketplaceSaleRepository } from "@/repositories/marketplaceSaleRepository";
import { productRepository } from "@/repositories/productRepository";
import { aggregateSalesBySku } from "@/domain/salesAggregation";
import { buildProfitabilityReport } from "@/domain/productProfitability";
import type { ProductInput } from "@/domain/breakEven";

export const productProfitabilityService = {
  async getReport(year: number, marginThreshold?: number) {
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);

    const [sales, products] = await Promise.all([
      marketplaceSaleRepository.findByPeriod(start, end),
      productRepository.findActive(),
    ]);

    const skus = aggregateSalesBySku(
      sales.map((s) => ({
        sku: s.sku,
        productName: s.productName,
        quantity: s.quantity,
        grossRevenue: Number(s.grossRevenue),
        netRevenue: Number(s.netRevenue),
        marketplaceCost: Number(s.marketplaceCost),
        status: s.status,
      })),
    );

    const productBySku = new Map<string, ProductInput>(
      products.filter((p) => p.sku).map((p) => [p.sku!, p]),
    );

    const { rows, suggestedMarginThreshold } = buildProfitabilityReport(skus, productBySku, marginThreshold);

    return { year, rows, suggestedMarginThreshold };
  },
};
