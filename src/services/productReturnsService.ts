import { fiscalNoteRepository } from "@/repositories/fiscalNoteRepository";
import { buildProductReturns } from "@/domain/productReturns";
import { shiftMonth } from "@/domain/fiscalNotes";
import { todayUTCInBrazil } from "@/lib/today";

export const productReturnsService = {
  /**
   * `months` meses terminando em `toMonth` ("YYYY-MM"; padrão: o mês passado,
   * que já tem as notas completas). Padrão de 3 meses: devolução costuma ser
   * de venda de mês anterior.
   */
  async getReport(months = 3, toMonth?: string) {
    const today = todayUTCInBrazil();
    const current = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
    const to = toMonth && /^\d{4}-\d{2}$/.test(toMonth) ? toMonth : shiftMonth(current, -1);
    const span = Math.min(12, Math.max(1, Math.round(months)));
    const from = shiftMonth(to, -(span - 1));
    const rows = await fiscalNoteRepository.findProductRowsBetween(from, to);
    return { from, to, months: span, ...buildProductReturns(rows) };
  },
};
