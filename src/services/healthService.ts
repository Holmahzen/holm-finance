import { dreService } from "@/services/dreService";
import { healthRepository } from "@/repositories/healthRepository";
import { computeHealthSignals, type HealthMonth } from "@/domain/health";

function lastNMonths(count: number, referenceYear: number, referenceMonth: number) {
  const result: { year: number; month: number }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const idx = referenceYear * 12 + (referenceMonth - 1) - i;
    result.push({ year: Math.floor(idx / 12), month: (idx % 12) + 1 });
  }
  return result;
}

export const healthService = {
  async getReport(months = 12, year?: number, month?: number) {
    const now = new Date();
    const refYear = year ?? now.getFullYear();
    const refMonth = month ?? now.getMonth() + 1;

    const periods = lastNMonths(months, refYear, refMonth);

    const [dres, balances] = await Promise.all([
      Promise.all(periods.map((p) => dreService.getDRE(p.year, p.month))),
      healthRepository.getBalanceHistory(periods.map((p) => new Date(p.year, p.month, 0, 23, 59, 59))),
    ]);

    const series: HealthMonth[] = dres.map((dre, i) => ({
      year: dre.period.year,
      month: dre.period.month,
      receitaLiquida: dre.receitaLiquida,
      despesasFixas: dre.despesasFixasTotal,
      despesasFixasByCategory: [
        ...dre.pessoal.lines,
        ...dre.administrativa.lines,
        ...dre.comercial.lines,
        ...dre.produtiva.lines,
      ],
      margemContribuicaoPercent:
        dre.receitaLiquida !== 0 ? (dre.margemContribuicao / dre.receitaLiquida) * 100 : null,
      lucroLiquido: dre.lucroLiquido,
      saldoConta: balances[i] ?? null,
    }));

    const signals = computeHealthSignals(series);

    return { series, signals };
  },
};
