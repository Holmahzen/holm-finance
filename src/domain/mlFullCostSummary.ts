/**
 * A tarifa de Armazenagem geral do Full não vem com SKU no relatório do ML
 * (diferente de coleta/armazenamento prolongado/retirada), então não dá pra
 * entrar na Lucratividade por produto — mas dá pra acompanhar a evolução
 * mês a mês, que é onde costuma aparecer o efeito de estoque parado demais
 * tempo no depósito (o ML cobra por dia parado, após um período grátis).
 */

export type MlFullCostRowForSummary = {
  costDate: Date;
  amount: number;
};

export type GeneralStorageMonthSummary = {
  /** "YYYY-MM" */
  month: string;
  total: number;
  count: number;
};

export function summarizeGeneralStorageByMonth(rows: MlFullCostRowForSummary[]): GeneralStorageMonthSummary[] {
  const byMonth = new Map<string, GeneralStorageMonthSummary>();
  for (const r of rows) {
    const month = `${r.costDate.getUTCFullYear()}-${String(r.costDate.getUTCMonth() + 1).padStart(2, "0")}`;
    const entry = byMonth.get(month) ?? { month, total: 0, count: 0 };
    entry.total += r.amount;
    entry.count += 1;
    byMonth.set(month, entry);
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}
