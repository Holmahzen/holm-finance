export type SkuTotalQuantity = {
  sku: string;
  quantity: number;
};

/**
 * Divide o total vendido de cada SKU (somado em todo o histórico importado)
 * pelo número de meses distintos com venda registrada, incluindo meses sem
 * nenhuma venda daquele SKU no denominador — assim a média reflete o mês
 * "normal", não só os meses em que o produto vendeu.
 */
export function computeAvgMonthlyQuantityBySku(
  totals: SkuTotalQuantity[],
  monthsCount: number,
): Record<string, number> {
  if (monthsCount <= 0) return {};

  const result: Record<string, number> = {};
  for (const t of totals) {
    result[t.sku] = Math.round(t.quantity / monthsCount);
  }
  return result;
}
