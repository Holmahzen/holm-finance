import { marketplaceSaleRepository } from "@/repositories/marketplaceSaleRepository";
import { isExcludedSaleStatus } from "@/domain/salesAggregation";

export const salesService = {
  async getReport(year: number, month: number) {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    const sales = await marketplaceSaleRepository.findByPeriod(start, end);
    // Cancelado/devolução parcial continuam listados na tabela pro histórico,
    // mas não contam nos totais — não são receita real.
    const validSales = sales.filter((s) => !isExcludedSaleStatus(s.status));

    const totalGrossRevenue = validSales.reduce((sum, s) => sum + Number(s.grossRevenue), 0);
    const totalNetRevenue = validSales.reduce((sum, s) => sum + Number(s.netRevenue), 0);
    const totalQuantity = validSales.reduce((sum, s) => sum + s.quantity, 0);

    return {
      period: { year, month },
      totalGrossRevenue,
      totalNetRevenue,
      totalQuantity,
      salesCount: validSales.length,
      sales,
    };
  },
};
