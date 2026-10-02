import { dreService } from "@/services/dreService";
import { fiscalNoteRepository } from "@/repositories/fiscalNoteRepository";
import { pgdasRepository } from "@/repositories/pgdasRepository";
import { summarizeMonths } from "@/domain/fiscalNotes";
import {
  computeTrailingMonths,
  computeSimplesNacionalStatus,
  addUnbilledRevenue,
  UNBILLED_REVENUE_CATEGORY,
  pickMonthlyRevenues,
  SIMPLES_NACIONAL_CEILING,
  SIMPLES_NACIONAL_SUBLIMIT,
} from "@/domain/simplesNacional";
import { todayUTCInBrazil } from "@/lib/today";

const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

export const simplesNacionalService = {
  async getReport() {
    const now = todayUTCInBrazil();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;

    const months = computeTrailingMonths(year, month, 12);
    const fromMonth = monthKey(months[0].year, months[0].month);
    const [dreRevenues, noteRows, pgdasRevenues, apuracoes] = await Promise.all([
      Promise.all(
        months.map(async ({ year: y, month: m }) => {
          const dre = await dreService.getDRE(y, m);
          const unbilled = dre.receitaBruta.lines
            .filter((l) => UNBILLED_REVENUE_CATEGORY.test(l.name))
            .reduce((sum, l) => sum + l.total, 0);
          return [monthKey(y, m), dre.receitaBruta.total, unbilled] as const;
        }),
      ),
      fiscalNoteRepository.findRowsSince(fromMonth),
      pgdasRepository.findMonthlyRevenues(fromMonth),
      pgdasRepository.findApuracoes(fromMonth),
    ]);

    const fromNotes = Object.fromEntries(
      summarizeMonths(noteRows).map((s) => [s.month, { netSales: s.netSales, saleNotes: s.saleNotes }]),
    );
    const monthlyRevenues = pickMonthlyRevenues(
      months,
      fromNotes,
      Object.fromEntries(dreRevenues.map(([key, total]) => [key, total])),
      pgdasRevenues,
    );
    const status = computeSimplesNacionalStatus(monthlyRevenues, year, month);

    // Receita que entra no caixa sem nota (atacado): para o Simples também é
    // faturamento. Fica à parte do número declarado, pra comparar os dois.
    const unbilledByMonth = Object.fromEntries(dreRevenues.map(([key, , unbilled]) => [key, unbilled]));
    const withUnbilledMonthly = addUnbilledRevenue(monthlyRevenues, unbilledByMonth);
    const withUnbilledStatus = computeSimplesNacionalStatus(withUnbilledMonthly, year, month);
    const unbilledTotal = withUnbilledMonthly.reduce((sum, m, i) => sum + m.revenue - monthlyRevenues[i].revenue, 0);

    // O RBT12 do extrato é a receita dos 12 meses ANTERIORES ao mês apurado; o
    // da tela soma os últimos 12 meses incluindo o mês em andamento. São
    // números diferentes por definição, então o oficial vai à parte.
    const latest = apuracoes.at(-1) ?? null;

    return {
      unbilled:
        unbilledTotal > 0
          ? {
              byMonth: withUnbilledMonthly.map((m, i) => ({ year: m.year, month: m.month, revenue: m.revenue - monthlyRevenues[i].revenue })),
              total12m: unbilledTotal,
              status: withUnbilledStatus,
            }
          : null,
      period: { year, month },
      ceiling: SIMPLES_NACIONAL_CEILING,
      sublimit: SIMPLES_NACIONAL_SUBLIMIT,
      monthlyRevenues,
      sources: {
        pgdas: monthlyRevenues.filter((m) => m.source === "pgdas").length,
        notas: monthlyRevenues.filter((m) => m.source === "notas").length,
        dre: monthlyRevenues.filter((m) => m.source === "dre").length,
      },
      official: latest
        ? {
            period: latest.period,
            rbt12: latest.rbt12,
            rba: latest.rba,
            sublimit: latest.sublimit,
            icmsBlocked: latest.icmsBlocked,
          }
        : null,
      apuracoes,
      ...status,
    };
  },
};
