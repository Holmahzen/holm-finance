/**
 * Um anúncio (MLB) do Mercado Livre costuma vender vários SKUs diferentes no
 * mesmo período — variações de tamanho/cor sob o mesmo código de anúncio.
 * O relatório de Ads só dá o investimento por anúncio, não por SKU, então
 * precisa ser dividido entre os SKUs que venderam sob aquele anúncio no
 * período — proporcional à receita bruta de cada um, já que é a métrica que
 * o resto da Lucratividade (curva ABC) também usa.
 */

export type SaleForAdAllocation = {
  sku: string;
  listingCode: string | null;
  grossRevenue: number;
};

export type AdSpendRowForAllocation = {
  listingCode: string;
  investimento: number;
};

export function allocateAdSpendBySku(
  sales: SaleForAdAllocation[],
  adSpendRows: AdSpendRowForAllocation[],
): Map<string, number> {
  const revenueByListingAndSku = new Map<string, Map<string, number>>();
  for (const s of sales) {
    if (!s.listingCode) continue;
    if (!revenueByListingAndSku.has(s.listingCode)) revenueByListingAndSku.set(s.listingCode, new Map());
    const bySku = revenueByListingAndSku.get(s.listingCode)!;
    bySku.set(s.sku, (bySku.get(s.sku) ?? 0) + s.grossRevenue);
  }

  const adSpendBySku = new Map<string, number>();
  for (const row of adSpendRows) {
    const bySku = revenueByListingAndSku.get(row.listingCode);
    if (!bySku || bySku.size === 0) continue;

    const totalRevenue = [...bySku.values()].reduce((sum, v) => sum + v, 0);
    // Se nenhum dos SKUs desse anúncio teve receita no período (ex.: só
    // cancelamento), divide igual entre eles em vez de descartar o gasto.
    for (const [sku, revenue] of bySku) {
      const share = totalRevenue > 0 ? revenue / totalRevenue : 1 / bySku.size;
      adSpendBySku.set(sku, (adSpendBySku.get(sku) ?? 0) + row.investimento * share);
    }
  }

  return adSpendBySku;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Fração de uma linha do relatório de Ads que cai dentro de [start, end).
 * O relatório vale pro período que o usuário escolheu ao exportar ("Desde" e
 * "Até", ambos inclusivos): um relatório de agosto+setembro consultado em
 * setembro só pode contar a metade dele, não o investimento inteiro.
 * Considera o gasto distribuído igualmente pelos dias do relatório.
 */
export function overlapShare(periodStart: Date, periodEnd: Date, start: Date, end: Date): number {
  const rowStart = periodStart.getTime();
  const rowEnd = periodEnd.getTime() + DAY_MS; // "Até" é inclusivo
  const totalDays = Math.max(1, Math.round((rowEnd - rowStart) / DAY_MS));
  const overlap = Math.min(rowEnd, end.getTime()) - Math.max(rowStart, start.getTime());
  if (overlap <= 0) return 0;
  return Math.min(1, Math.round(overlap / DAY_MS) / totalDays);
}
