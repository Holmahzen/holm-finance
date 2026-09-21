import { mlFullCostRepository } from "@/repositories/mlFullCostRepository";
import { summarizeGeneralStorageByMonth } from "@/domain/mlFullCostSummary";

export const mlFullCostSummaryService = {
  async getGeneralStorageByMonth() {
    const rows = await mlFullCostRepository.findGeneralStorage();
    return summarizeGeneralStorageByMonth(rows.map((r) => ({ costDate: r.costDate, amount: Number(r.amount) })));
  },
};
