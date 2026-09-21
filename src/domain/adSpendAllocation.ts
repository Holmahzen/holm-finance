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
