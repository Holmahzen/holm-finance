import { fiscalNoteRepository } from "@/repositories/fiscalNoteRepository";
import { computeRbt12, detailForMonth, shiftMonth, summarizeMonths } from "@/domain/fiscalNotes";

/** A tela mostra até dois anos — o bastante pra RBT12 do mês mais antigo visível. */
const HISTORY_MONTHS = 24;

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export const fiscalNoteReportService = {
  async getReport(requestedMonth?: string) {
    const from = shiftMonth(currentMonth(), -(HISTORY_MONTHS - 1));
    const [rows, summary] = await Promise.all([
      fiscalNoteRepository.findRowsSince(from),
      fiscalNoteRepository.getImportSummary(),
    ]);

    const months = summarizeMonths(rows);
    const available = months.map((m) => m.month);
    const month =
      requestedMonth && available.includes(requestedMonth) ? requestedMonth : (available.at(-1) ?? null);

    return {
      ...summary,
      months,
      month,
      detail: month ? detailForMonth(rows, month) : null,
      rbt12: month ? computeRbt12(months, month) : null,
    };
  },
};
