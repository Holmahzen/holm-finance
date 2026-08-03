import { dreService } from "@/services/dreService";
import { breakEvenService } from "@/services/breakEvenService";
import { salesService } from "@/services/salesService";
import { dashboardRepository } from "@/repositories/dashboardRepository";
import { dreRepository } from "@/repositories/dreRepository";
import { productRepository } from "@/repositories/productRepository";
import { marketplaceSaleRepository } from "@/repositories/marketplaceSaleRepository";
import { computeCogsBySku } from "@/domain/cogs";
import { isExcludedSaleStatus } from "@/domain/salesAggregation";
import {
  computeGrossMargin,
  computeCAC,
  computeAverageTicket,
  computeCashGeneration,
} from "@/domain/executiveDashboard";

export const executiveDashboardService = {
  async getSummary(year?: number, month?: number) {
    const now = new Date();
    const y = year ?? now.getFullYear();
    const m = month ?? now.getMonth() + 1;
    const monthStart = new Date(y, m - 1, 1);
    const monthEnd = new Date(y, m, 1);

    const [dre, breakEven, salesReport, flow, soldQuantities, productCosts, adSpend, customerRows] =
      await Promise.all([
        dreService.getDRE(y, m),
        breakEvenService.getReport(y, m),
        salesService.getReport(y, m),
        dashboardRepository.getMonthlyFlow(monthStart, monthEnd),
        dreRepository.getSoldQuantitiesBySku(monthStart, monthEnd),
        productRepository.getProductCostsBySku(),
        dreRepository.getAdvertisingSpend(monthStart, monthEnd),
        marketplaceSaleRepository.findCustomerNamesByPeriod(monthStart, monthEnd),
      ]);

    const cogs = computeCogsBySku(soldQuantities, productCosts);
    const cogsTotal = cogs.tecido + cogs.costura + cogs.aviamentos;
    const grossMargin = computeGrossMargin(dre.receitaLiquida, cogsTotal);

    const uniqueCustomers = new Set(
      customerRows
        .filter((r) => !isExcludedSaleStatus(r.status))
        .map((r) => r.customerName!.trim().toLowerCase()),
    ).size;
    const cac = computeCAC(adSpend, uniqueCustomers);

    const averageTicket = computeAverageTicket(salesReport.totalGrossRevenue, salesReport.salesCount);

    const cashGeneration = computeCashGeneration(Number(flow.inflow), Number(flow.outflow));

    return {
      period: { year: y, month: m },
      faturamento: dre.receitaBruta.total,
      margemBruta: grossMargin,
      margemContribuicao: dre.margemContribuicao,
      lucroLiquido: dre.lucroLiquido,
      pontoDeEquilibrioRevenue: breakEven.breakEven.breakEvenRevenue,
      ebitda: dre.resultadoOperacional,
      ticketMedio: averageTicket,
      salesCount: salesReport.salesCount,
      adSpend,
      uniqueCustomers,
      cac,
      cashGeneration,
      cashInflow: Number(flow.inflow),
      cashOutflow: Number(flow.outflow),
      cogsCoveragePercent: cogs.coveragePercent,
    };
  },
};
