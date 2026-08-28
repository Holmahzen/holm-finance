import { dreService } from "@/services/dreService";
import { salesService } from "@/services/salesService";
import { companyProjectionService } from "@/services/companyProjectionService";
import { percentChange } from "@/domain/health";
import { aggregateSalesBySku } from "@/domain/salesAggregation";

export const monthlyReportService = {
  async getReport(year?: number, month?: number) {
    const now = new Date();
    const y = year ?? now.getFullYear();
    const m = month ?? now.getMonth() + 1;

    const prevIdx = m - 1 - 1;
    const prevYear = y + Math.floor(prevIdx / 12);
    const prevMonth = ((prevIdx % 12) + 12) % 12 + 1;

    // Projeção do mês que vem parte sempre de hoje (o ritmo diário real só
    // existe pro mês corrente) — independente de qual período está sendo
    // visto no resto do relatório.
    const nextIdx = now.getMonth() + 1;
    const nextMonthYear = now.getFullYear() + Math.floor(nextIdx / 12);
    const nextMonth = (nextIdx % 12) + 1;
    const daysInNextMonth = new Date(nextMonthYear, nextMonth, 0).getDate();

    const [dre, previousDre, sales, projection] = await Promise.all([
      dreService.getDRE(y, m),
      dreService.getDRE(prevYear, prevMonth),
      salesService.getReport(y, m),
      companyProjectionService.getReport(daysInNextMonth),
    ]);

    const growth = {
      receitaBruta: {
        atual: dre.receitaBruta.total,
        anterior: previousDre.receitaBruta.total,
        percent: percentChange(previousDre.receitaBruta.total, dre.receitaBruta.total),
      },
      lucroLiquido: {
        atual: dre.lucroLiquido,
        anterior: previousDre.lucroLiquido,
        percent: percentChange(previousDre.lucroLiquido, dre.lucroLiquido),
      },
    };

    const skuAggregates = aggregateSalesBySku(
      sales.sales.map((s) => ({
        sku: s.sku,
        productName: s.productName,
        quantity: s.quantity,
        grossRevenue: Number(s.grossRevenue),
        netRevenue: Number(s.netRevenue),
        marketplaceCost: Number(s.marketplaceCost),
        status: s.status,
      })),
    );
    const topProducts = [...skuAggregates].sort((a, b) => b.grossRevenue - a.grossRevenue).slice(0, 5);

    return {
      period: { year: y, month: m },
      previousPeriod: { year: prevYear, month: prevMonth },
      dre,
      growth,
      salesSummary: {
        totalGrossRevenue: sales.totalGrossRevenue,
        totalNetRevenue: sales.totalNetRevenue,
        totalQuantity: sales.totalQuantity,
        salesCount: sales.salesCount,
        topProducts,
      },
      nextMonthProjection: {
        period: { year: nextMonthYear, month: nextMonth },
        days: daysInNextMonth,
        hasSalesPace: projection.hasSalesPace,
        projectedRevenue: projection.revenueProfit.projectedRevenue,
        projectedProfit: projection.revenueProfit.projectedProfit,
      },
    };
  },
};
