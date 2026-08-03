import { marketplaceSaleRepository } from "@/repositories/marketplaceSaleRepository";
import { aggregateSalesBySku } from "@/domain/salesAggregation";
import { computeAvgMonthlyQuantityBySku } from "@/domain/avgMonthlyQuantity";

export const avgMonthlyQuantityService = {
  async computeForAllSkus() {
    const sales = await marketplaceSaleRepository.findAllForAggregation();

    // Usa métodos UTC: o timestamp vem do Postgres sem timezone, e em fuso
    // America/Sao_Paulo (UTC-3) os métodos locais (getMonth/getFullYear)
    // jogariam vendas exatamente à meia-noite do dia 1º pro mês anterior.
    const monthKeys = new Set(
      sales.map((s) => `${s.saleDate.getUTCFullYear()}-${s.saleDate.getUTCMonth() + 1}`),
    );
    const monthsCount = monthKeys.size;

    const totals = aggregateSalesBySku(
      sales.map((s) => ({
        sku: s.sku,
        productName: s.productName,
        quantity: s.quantity,
        grossRevenue: Number(s.grossRevenue),
        netRevenue: Number(s.netRevenue),
        status: s.status,
      })),
    );

    const bySku = computeAvgMonthlyQuantityBySku(totals, monthsCount);

    return { monthsCount, bySku };
  },
};
