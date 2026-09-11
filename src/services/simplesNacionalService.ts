import { dreService } from "@/services/dreService";
import { fiscalNoteRepository } from "@/repositories/fiscalNoteRepository";
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
    const [dreRevenues, noteRows] = await Promise.all([
      Promise.all(
        months.map(async ({ year: y, month: m }) => {
          const dre = await dreService.getDRE(y, m);
          return [monthKey(y, m), dre.receitaBruta.total] as const;
        }),
      ),
      fiscalNoteRepository.findRowsSince(monthKey(months[0].year, months[0].month)),
    ]);

    const fromNotes = Object.fromEntries(
      summarizeMonths(noteRows).map((s) => [s.month, { netSales: s.netSales, saleNotes: s.saleNotes }]),
    );
    const monthlyRevenues = pickMonthlyRevenues(months, fromNotes, Object.fromEntries(dreRevenues));
    const status = computeSimplesNacionalStatus(monthlyRevenues, year, month);

    return {
      period: { year, month },
      ceiling: SIMPLES_NACIONAL_CEILING,
      sublimit: SIMPLES_NACIONAL_SUBLIMIT,
      monthlyRevenues,
      sources: {
        notas: monthlyRevenues.filter((m) => m.source === "notas").length,
        dre: monthlyRevenues.filter((m) => m.source === "dre").length,
      },
      ...status,
    };
  },
};
