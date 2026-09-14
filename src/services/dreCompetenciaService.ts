import { dreService } from "@/services/dreService";
import { dreRepository } from "@/repositories/dreRepository";
import { fiscalNoteRepository } from "@/repositories/fiscalNoteRepository";
import { pgdasRepository } from "@/repositories/pgdasRepository";
import { mlServiceInvoiceRepository } from "@/repositories/mlServiceInvoiceRepository";
import { shiftMonth, summarizeMonths } from "@/domain/fiscalNotes";
import { mlServiceDetailForMonth } from "@/domain/mlServices";
import { buildCompetenceDre } from "@/domain/dreCompetencia";

/** Até dois anos de histórico; a tabela mês a mês mostra os 12 mais recentes. */
const HISTORY_MONTHS = 24;
const TREND_MONTHS = 12;

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export const dreCompetenciaService = {
  async getReport(requestedMonth?: string) {
    const from = shiftMonth(currentMonth(), -(HISTORY_MONTHS - 1));
    const [noteRows, apuracoes, services] = await Promise.all([
      fiscalNoteRepository.findRowsSince(from),
      pgdasRepository.findApuracoes(from),
      mlServiceInvoiceRepository.findSince(from),
    ]);

    const summaries = summarizeMonths(noteRows);
    const salesByMonth = new Map(summaries.filter((s) => s.saleNotes > 0).map((s) => [s.month, s]));
    const pgdasByMonth = new Map(apuracoes.map((a) => [a.period, a]));
    const months = [...new Set([...salesByMonth.keys(), ...pgdasByMonth.keys()])].sort();

    if (months.length === 0) return { months, month: null, report: null, trend: [] };
    const month = requestedMonth && months.includes(requestedMonth) ? requestedMonth : months.at(-1)!;

    /** Alíquota efetiva do extrato mais recente até o mês (ou o mais recente de todos). */
    const dasRateFor = (m: string) => {
      const withRevenue = apuracoes.filter((a) => a.revenue > 0);
      const prior = withRevenue.filter((a) => a.period <= m).at(-1) ?? withRevenue.at(-1);
      return prior ? { rate: prior.taxes.total / prior.revenue, period: prior.period } : null;
    };

    const build = async (m: string) => {
      const [year, monthNumber] = m.split("-").map(Number);
      const [cash, soldGrossRevenue] = await Promise.all([
        dreService.getDRE(year, monthNumber),
        dreRepository.getSoldGrossRevenue(new Date(year, monthNumber - 1, 1), new Date(year, monthNumber, 1)),
      ]);
      const sale = salesByMonth.get(m);
      const pgdas = pgdasByMonth.get(m);
      const serviceDetail = mlServiceDetailForMonth(services, m);
      return buildCompetenceDre({
        month: m,
        sales: sale ? { grossSales: sale.grossSales, returns: sale.returns, saleNotes: sale.saleNotes } : null,
        pgdas: pgdas ? { revenue: pgdas.revenue, das: pgdas.taxes.total } : null,
        latestDasRate: dasRateFor(m),
        services:
          serviceDetail.count > 0
            ? {
                total: serviceDetail.total,
                count: serviceDetail.count,
                byCategory: serviceDetail.byCategory.map((c) => ({ key: c.key, label: c.label, value: c.value })),
              }
            : null,
        cash,
        cmvFromSoldPieces:
          cash.cogsCoveragePercent !== null && cash.cogsCoveragePercent >= cash.cogsMinCoveragePercent,
        soldGrossRevenue: soldGrossRevenue > 0 ? soldGrossRevenue : null,
      });
    };

    const report = await build(month);
    const trendMonths = months.slice(-TREND_MONTHS);
    const trend = await Promise.all(
      trendMonths.map(async (m) => {
        const r = m === month ? report : await build(m);
        return {
          month: m,
          revenueSource: r.revenueSource,
          receitaBruta: r.receitaBruta,
          das: r.das,
          dasEstimated: r.dasSource === "estimado",
          tarifas: r.tarifas,
          margem: r.margemContribuicao,
          resultado: r.resultado,
          cashResult: r.cashResult,
          hasCosts: r.hasCosts,
        };
      }),
    );

    return { months, month, report, trend };
  },
};
