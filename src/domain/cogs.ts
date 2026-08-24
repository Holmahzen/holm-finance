export type SkuQuantity = { sku: string; quantity: number };
export type ProductCostBySku = {
  sku: string;
  tecidoCost: number;
  costuraCost: number;
  aviamentosCost: number;
};

export type CogsResult = {
  tecido: number;
  costura: number;
  aviamentos: number;
  matchedSkus: number;
  unmatchedSkus: number;
  matchedQuantity: number;
  totalQuantity: number;
  /** % da quantidade vendida no período com custo cadastrado, 0-100. null se não houve venda. */
  coveragePercent: number | null;
};

/**
 * Custo de tecido/costura/aviamentos das peças efetivamente vendidas no
 * período (quantidade vendida × custo por peça cadastrado no produto),
 * em vez de quanto foi pago no mês. SKUs vendidos sem custo cadastrado no
 * produto não entram nessa conta (ficam em `unmatchedSkus`/fora de
 * `matchedQuantity`) — o chamador decide se cai de volta pro valor pago em
 * caixa, usando `coveragePercent` pra saber se a amostra é grande o
 * suficiente pra confiar no total.
 */
export function computeCogsBySku(
  soldQuantities: SkuQuantity[],
  productCosts: ProductCostBySku[],
): CogsResult {
  const costBySku = new Map(productCosts.map((p) => [p.sku, p]));

  let tecido = 0;
  let costura = 0;
  let aviamentos = 0;
  let matchedSkus = 0;
  let unmatchedSkus = 0;
  let matchedQuantity = 0;
  let totalQuantity = 0;

  for (const s of soldQuantities) {
    totalQuantity += s.quantity;
    const cost = costBySku.get(s.sku);
    if (!cost) {
      unmatchedSkus++;
      continue;
    }
    tecido += cost.tecidoCost * s.quantity;
    costura += cost.costuraCost * s.quantity;
    aviamentos += cost.aviamentosCost * s.quantity;
    matchedSkus++;
    matchedQuantity += s.quantity;
  }

  const coveragePercent = totalQuantity > 0 ? (matchedQuantity / totalQuantity) * 100 : null;

  return {
    tecido,
    costura,
    aviamentos,
    matchedSkus,
    unmatchedSkus,
    matchedQuantity,
    totalQuantity,
    coveragePercent,
  };
}

export type MaterialSpendSplit = {
  tecidoPercent: number;
  aviamentoPercent: number;
};

/**
 * Divide um valor de compra entre tecido e aviamento na mesma proporção do
 * que já foi gasto com peças vendidas — costura fica de fora por ser mão de
 * obra, não material que se compra/estoca. `null` sem base nenhuma pra
 * calcular a proporção (tecido + aviamentos = 0).
 */
export function computeMaterialSpendSplit(tecido: number, aviamentos: number): MaterialSpendSplit | null {
  const total = tecido + aviamentos;
  if (total <= 0) return null;

  return {
    tecidoPercent: (tecido / total) * 100,
    aviamentoPercent: (aviamentos / total) * 100,
  };
}
