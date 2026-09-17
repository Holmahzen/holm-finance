import { marketplaceSaleRepository } from "@/repositories/marketplaceSaleRepository";
import { isExcludedSaleStatus, groupSalesByModality } from "@/domain/salesAggregation";
import { FLEX_COST_PER_PACKAGE } from "@/domain/breakEven";

function buildReport(sales: Awaited<ReturnType<typeof marketplaceSaleRepository.findByPeriod>>) {
  // Cancelado/devolução parcial continuam listados na tabela pro histórico,
  // mas não contam nos totais — não são receita real.
  const validSales = sales.filter((s) => !isExcludedSaleStatus(s.status));

  const totalGrossRevenue = validSales.reduce((sum, s) => sum + Number(s.grossRevenue), 0);
  const totalNetRevenue = validSales.reduce((sum, s) => sum + Number(s.netRevenue), 0);
  const totalQuantity = validSales.reduce((sum, s) => sum + s.quantity, 0);

  const byModality = groupSalesByModality(
    validSales.map((s) => ({
      shippingModality: s.shippingModality,
      quantity: s.quantity,
      grossRevenue: Number(s.grossRevenue),
      netRevenue: Number(s.netRevenue),
    })),
  );

  const flexBucket = byModality.find((b) => b.modality === "Flex");
  const flexExpectedInvoice = flexBucket ? flexBucket.count * FLEX_COST_PER_PACKAGE : 0;

  return {
    totalGrossRevenue,
    totalNetRevenue,
    totalQuantity,
    salesCount: validSales.length,
    sales,
    byModality,
    flexExpectedInvoice,
  };
}

export const salesService = {
  async getReport(year: number, month: number) {
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 1));
    const sales = await marketplaceSaleRepository.findByPeriod(start, end);
    return { period: { year, month }, ...buildReport(sales) };
  },

  /** `to` é exclusivo — pra cobrir "até 15/09" inclusive, passe 16/09 como `to`. */
  async getReportByRange(from: Date, to: Date) {
    const sales = await marketplaceSaleRepository.findByPeriod(from, to);
    return { range: { from: from.toISOString(), to: to.toISOString() }, ...buildReport(sales) };
  },
};
