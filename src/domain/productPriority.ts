import type { SkuSalesAggregate } from "@/domain/salesAggregation";

export type UncostedSku = SkuSalesAggregate & {
  revenueShare: number;
  cumulativeShare: number;
};

/**
 * Dos SKUs vendidos no período, filtra os que ainda não têm custo de
 * peça cadastrado (tecido/costura/aviamentos) e ordena do que mais vende
 * pro que menos vende — pra priorizar o cadastro pelos que mais afetam a
 * DRE, em vez de encarar todos os SKUs de uma vez.
 */
export function rankUncostedProducts(
  soldSkus: SkuSalesAggregate[],
  costedSkus: ReadonlySet<string>,
): UncostedSku[] {
  const uncosted = soldSkus.filter((s) => !costedSkus.has(s.sku));
  const sorted = [...uncosted].sort((a, b) => b.grossRevenue - a.grossRevenue);

  const totalRevenue = soldSkus.reduce((sum, s) => sum + s.grossRevenue, 0);
  let cumulative = 0;

  return sorted.map((s) => {
    const revenueShare = totalRevenue > 0 ? s.grossRevenue / totalRevenue : 0;
    cumulative += revenueShare;
    return { ...s, revenueShare, cumulativeShare: cumulative };
  });
}
