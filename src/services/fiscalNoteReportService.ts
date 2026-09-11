import { fiscalNoteRepository } from "@/repositories/fiscalNoteRepository";
import { mlServiceInvoiceRepository } from "@/repositories/mlServiceInvoiceRepository";
import { computeRbt12, detailForMonth, emptyMonth, shiftMonth, summarizeMonths } from "@/domain/fiscalNotes";
import { mlServiceDetailForMonth, mlServiceTotalsByMonth } from "@/domain/mlServices";
import { codeBreakdown } from "@/domain/fiscalCodes";

/** A tela mostra até dois anos — o bastante pra RBT12 do mês mais antigo visível. */
const HISTORY_MONTHS = 24;

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export const fiscalNoteReportService = {
  async getReport(requestedMonth?: string) {
    const from = shiftMonth(currentMonth(), -(HISTORY_MONTHS - 1));
    const [rows, summary, services] = await Promise.all([
      fiscalNoteRepository.findRowsSince(from),
      fiscalNoteRepository.getImportSummary(),
      mlServiceInvoiceRepository.findSince(from),
    ]);

    // Mês que só tem nota de serviço do ML também aparece na lista.
    const months = summarizeMonths(rows);
    const serviceTotals = mlServiceTotalsByMonth(services);
    for (const m of Object.keys(serviceTotals)) {
      if (!months.some((s) => s.month === m)) months.push(emptyMonth(m));
    }
    months.sort((a, b) => a.month.localeCompare(b.month));

    const available = months.map((m) => m.month);
    const month =
      requestedMonth && available.includes(requestedMonth) ? requestedMonth : (available.at(-1) ?? null);

    return {
      ...summary,
      months,
      month,
      detail: month ? detailForMonth(rows, month) : null,
      rbt12: month ? computeRbt12(months, month) : null,
      codes: month
        ? {
            sale: codeBreakdown(rows, month, "sale"),
            return: codeBreakdown(rows, month, "return"),
            purchase: codeBreakdown(rows, month, "purchase"),
          }
        : null,
      mlServices: {
        count: services.length,
        monthTotals: serviceTotals,
        detail: month ? mlServiceDetailForMonth(services, month) : null,
      },
    };
  },
};
