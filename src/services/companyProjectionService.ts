import { breakEvenService } from "@/services/breakEvenService";
import { cashFlowService } from "@/services/cashFlowService";
import { computeRevenueProfitProjection } from "@/domain/companyProjection";

export const companyProjectionService = {
  async getReport(days = 90) {
    const [breakEven, cashFlow] = await Promise.all([
      breakEvenService.getReport(),
      cashFlowService.getProjection(days),
    ]);

    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    // Ritmo diário de faturamento vem da mesma projeção de fechamento do mês
    // já calculada em Ponto de Equilíbrio (faturamento acumulado / dias
    // decorridos) — extrapolado aqui pra `days` dias à frente, assumindo
    // ritmo constante (sem sazonalidade).
    const dailyRevenuePace = breakEven.projection?.dailyPace ?? 0;
    const dailyFixedCost = breakEven.fixedCostsTotal / daysInMonth;
    const dailyTargetPace =
      breakEven.breakEven.breakEvenRevenue !== null
        ? breakEven.breakEven.breakEvenRevenue / daysInMonth
        : null;

    const revenueProfit = computeRevenueProfitProjection({
      days,
      dailyRevenuePace,
      weightedMarginPercent: breakEven.breakEven.weightedMarginPercent,
      dailyFixedCost,
      dailyTargetPace,
    });

    return {
      days,
      hasSalesPace: breakEven.projection !== null,
      revenueProfit,
      startingBalance: cashFlow.startingBalance,
      cashDays: cashFlow.days,
      firstNegativeDay: cashFlow.firstNegativeDay,
    };
  },
};
