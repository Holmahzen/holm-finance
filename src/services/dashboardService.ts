import { Prisma } from "@/generated/prisma/client";
import { dashboardRepository } from "@/repositories/dashboardRepository";
import { dreService } from "@/services/dreService";
import { cashFlowService } from "@/services/cashFlowService";
import { healthService } from "@/services/healthService";

const RELEVANT_SEVERITIES = new Set(["critical", "warning"]);

export const dashboardService = {
  async getSummary(year?: number, month?: number) {
    const now = new Date();
    const y = year ?? now.getFullYear();
    const m = month ?? now.getMonth() + 1;
    const monthStart = new Date(y, m - 1, 1);
    const monthEnd = new Date(y, m, 1);

    const [
      accounts,
      entries,
      reconciliation,
      flow,
      expensesByCategory,
      topSuppliers,
      topClients,
      dre,
      cashFlow,
      health,
    ] = await Promise.all([
      dashboardRepository.getAccountBalances(),
      dashboardRepository.getPendingEntriesSummary(),
      dashboardRepository.getReconciliationCounts(),
      dashboardRepository.getMonthlyFlow(monthStart, monthEnd),
      dashboardRepository.getByCategory("PAYABLE", monthStart, monthEnd),
      dashboardRepository.getTopCounterparties("PAYABLE", monthStart, monthEnd, 5),
      dashboardRepository.getTopCounterparties("RECEIVABLE", monthStart, monthEnd, 5),
      dreService.getDRE(y, m),
      cashFlowService.getProjection(30),
      healthService.getReport(12),
    ]);

    const totalBalance = accounts.reduce(
      (acc, a) => acc.add(a.balance),
      new Prisma.Decimal(0),
    );

    return {
      period: { year: y, month: m },
      accounts,
      totalBalance,
      entries,
      reconciliation,
      flow,
      lucroLiquido: dre.lucroLiquido,
      cashFlowAlert: cashFlow.firstNegativeDay
        ? {
            date: cashFlow.firstNegativeDay.date,
            runningBalance: cashFlow.firstNegativeDay.runningBalance,
          }
        : null,
      healthSignals: health.signals.filter((s) => RELEVANT_SEVERITIES.has(s.severity)).slice(0, 3),
      charts: { expensesByCategory, topSuppliers, topClients },
    };
  },
};
