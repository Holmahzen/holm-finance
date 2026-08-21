import { fixedCostRepository } from "@/repositories/fixedCostRepository";
import { reserveDepositRepository } from "@/repositories/reserveDepositRepository";
import { dashboardRepository } from "@/repositories/dashboardRepository";
import { computeFixedCostMonthlyAmount } from "@/domain/fixedCostSchedule";
import {
  computeThirteenthProvision,
  computeVacationProvision,
  computeContingencyTarget,
  computeTaxEstimate,
  computeTaxDueDate,
  computeDaysUntil,
  computeDaysRemainingInMonth,
  computeDailyGoal,
} from "@/domain/cashReserve";

function monthlyAmount(
  fc: { frequency: "MONTHLY" | "BIWEEKLY" | "WEEKLY"; dueDay: number | null; secondDueDay: number | null; weekday: number | null; amount: unknown },
  year: number,
  month: number,
) {
  return computeFixedCostMonthlyAmount({ ...fc, amount: Number(fc.amount) }, year, month);
}

export const cashReserveService = {
  async getReport(contingencyMonths = 3, taxRatePercent = 14, taxDueDay = 20) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthsElapsed = month;
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 1);

    const [fixedCosts, monthlyFlow] = await Promise.all([
      fixedCostRepository.findMany(),
      dashboardRepository.getMonthlyFlow(monthStart, monthEnd),
    ]);
    const active = fixedCosts.filter((fc) => fc.isActive && fc.type === "PAYABLE");

    const salaryCosts = active.filter((fc) => fc.laborProvisionEligible);
    const monthlySalaries = salaryCosts.reduce((sum, fc) => sum + monthlyAmount(fc, year, month), 0);
    const totalMonthlyFixedCosts = active.reduce((sum, fc) => sum + monthlyAmount(fc, year, month), 0);
    const currentMonthRevenue = Number(monthlyFlow.inflow);

    const thirteenth = computeThirteenthProvision(monthlySalaries, monthsElapsed);
    const vacation = computeVacationProvision(monthlySalaries, monthsElapsed);
    const contingencyTarget = computeContingencyTarget(totalMonthlyFixedCosts, contingencyMonths);
    const contingencyMonthlySaving = contingencyTarget / 12;
    const taxTarget = computeTaxEstimate(currentMonthRevenue, taxRatePercent);
    const taxDueDate = computeTaxDueDate(year, month, taxDueDay);
    const taxDaysUntilDue = computeDaysUntil(taxDueDate, now);

    // Meta diária: quanto guardar por dia, no ritmo do que resta do mês, pra
    // bater cada meta mensal até o fim do mês corrente.
    const daysRemainingInMonth = computeDaysRemainingInMonth(year, month, now.getDate());
    const thirteenthDailyGoal = computeDailyGoal(thirteenth.monthlyAccrual, daysRemainingInMonth);
    const vacationDailyGoal = computeDailyGoal(vacation.monthlyAccrual, daysRemainingInMonth);
    const contingencyDailyGoal = computeDailyGoal(contingencyMonthlySaving, daysRemainingInMonth);
    const taxDailyGoal = computeDailyGoal(taxTarget, daysRemainingInMonth);

    // 13º e férias são obrigações do ano corrente (pagas/tiradas até dezembro,
    // depois zeram de novo); imprevistos é uma reserva permanente, então os
    // depósitos contam pra sempre; imposto é mensal (DAS é calculado sobre o
    // faturamento de cada mês), então só conta o que foi guardado neste mês.
    const deposits = await reserveDepositRepository.findMany();
    const sumDeposits = (
      category: "THIRTEENTH" | "VACATION" | "CONTINGENCY" | "TAX",
      scope: "year" | "month" | "all",
    ) =>
      deposits
        .filter((d) => {
          if (d.category !== category) return false;
          if (scope === "all") return true;
          if (scope === "year") return d.date.getFullYear() === year;
          return d.date.getFullYear() === year && d.date.getMonth() + 1 === month;
        })
        .reduce((sum, d) => sum + Number(d.amount), 0);

    const thirteenthSaved = sumDeposits("THIRTEENTH", "year");
    const vacationSaved = sumDeposits("VACATION", "year");
    const contingencySaved = sumDeposits("CONTINGENCY", "all");
    const taxSaved = sumDeposits("TAX", "month");

    return {
      period: { year, month, monthsElapsed },
      monthlySalaries,
      totalMonthlyFixedCosts,
      daysRemainingInMonth,
      thirteenth: { ...thirteenth, saved: thirteenthSaved, dailyGoal: thirteenthDailyGoal },
      vacation: { ...vacation, saved: vacationSaved, dailyGoal: vacationDailyGoal },
      contingency: {
        monthsOfCoverage: contingencyMonths,
        target: contingencyTarget,
        suggestedMonthlySaving: contingencyMonthlySaving,
        saved: contingencySaved,
        dailyGoal: contingencyDailyGoal,
      },
      tax: {
        ratePercent: taxRatePercent,
        monthlyRevenue: currentMonthRevenue,
        target: taxTarget,
        saved: taxSaved,
        dueDay: taxDueDay,
        dueDate: taxDueDate,
        daysUntilDue: taxDaysUntilDue,
        dailyGoal: taxDailyGoal,
      },
      totalMonthlyRecommendedSaving:
        thirteenth.monthlyAccrual + vacation.monthlyAccrual + contingencyMonthlySaving + taxTarget,
      totalDailyGoal:
        thirteenthDailyGoal + vacationDailyGoal + contingencyDailyGoal + taxDailyGoal,
      eligibleFixedCosts: salaryCosts.map((fc) => ({
        id: fc.id,
        description: fc.description,
        monthlyAmount: monthlyAmount(fc, year, month),
      })),
    };
  },
};
