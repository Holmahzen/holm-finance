import { dreService } from "@/services/dreService";
import { fiscalNoteRepository } from "@/repositories/fiscalNoteRepository";
import { pgdasRepository } from "@/repositories/pgdasRepository";
import { summarizeMonths } from "@/domain/fiscalNotes";
import {
  computeTrailingMonths,
  computeSimplesNacionalStatus,
  pickMonthlyRevenues,
  SIMPLES_NACIONAL_CEILING,
  SIMPLES_NACIONAL_SUBLIMIT,
} from "@/domain/simplesNacional";

const monthKey = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

export const simplesNacionalService = {
  async getReport() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const months = computeTrailingMonths(year, month, 12);
    const fromMonth = monthKey(months[0].year, months[0].month);
    const [dreRevenues, noteRows, pgdasRevenues, apuracoes] = await Promise.all([
      Promise.all(
        months.map(async ({ year: y, month: m }) => {
          const dre = await dreService.getDRE(y, m);
          return [monthKey(y, m), dre.receitaBruta.total] as const;
        }),
      ),
      fiscalNoteRepository.findRowsSince(fromMonth),
      pgdasRepository.findMonthlyRevenues(fromMonth),
      pgdasRepository.findApuracoes(fromMonth),
    ]);

    const fromNotes = Object.fromEntries(
      summarizeMonths(noteRows).map((s) => [s.month, { netSales: s.netSales, saleNotes: s.saleNotes }]),
    );
    const monthlyRevenues = pickMonthlyRevenues(months, fromNotes, Object.fromEntries(dreRevenues), pgdasRevenues);
    const status = computeSimplesNacionalStatus(monthlyRevenues, year, month);

    // O RBT12 do extrato é a receita dos 12 meses ANTERIORES ao mês apurado; o
    // da tela soma os últimos 12 meses incluindo o mês em andamento. São
    // números diferentes por definição, então o oficial vai à parte.
    const latest = apuracoes.at(-1) ?? null;

    return {
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
