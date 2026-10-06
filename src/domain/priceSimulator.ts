/**
 * Simulador de preço por modelo: quanto cobrar pra chegar numa margem final.
 *
 * Parte da venda real do período (o que o Mercado Turbo deixou depois de
 * imposto, tarifa e frete) e separa os descontos em duas partes:
 * - a que cresce com o preço: imposto + comissão do marketplace (%);
 * - a fixa por peça: o resto (tarifa fixa, frete, Flex), deduzida da venda
 *   real — por isso, no preço atual, a margem simulada bate com a medida.
 * Ads entra como % da receita (TACOS do período). É uma aproximação: se o
 * preço cruzar a faixa de frete grátis do Mercado Livre (R$ 79), a parte fixa
 * muda e precisa ser conferida.
 */

export type ModelEconomics = {
  units: number;
  grossRevenue: number;
  /** Receita menos imposto, tarifa, frete e Flex, antes do custo de produção. */
  beforeProductionCost: number;
  adSpend: number;
  /** Custo de produção médio por peça (tecido + costura + aviamentos). */
  unitCost: number;
};

export type PriceAssumptions = {
  /** Imposto que o Mercado Turbo desconta hoje (fração, ex.: 0.14). */
  taxRate: number;
  /** Comissão do marketplace que cresce com o preço (fração). */
  commissionRate: number;
  /** Desconta o Ads (TACOS do período) da margem. */
  includeAds: boolean;
  /**
   * Tarifa fixa + frete + Flex + embalagem por peça (R$) a usar quando o preço testado
   * passa de R$ 79 e o modelo hoje vende abaixo disso — aí o frete grátis vira custo seu
   * e a parte medida nas vendas reais deixa de valer. null/ausente: mantém a medida.
   */
  fixedAboveFreeShipping?: number | null;
};

/** Faixa do Mercado Livre a partir da qual o frete grátis fica por conta do vendedor. */
export const ML_FREE_SHIPPING_THRESHOLD = 79;

export type UnitBreakdown = {
  price: number;
  tax: number;
  commission: number;
  fixedPerUnit: number;
  ads: number;
  productionCost: number;
  contribution: number;
  marginPercent: number;
};

function currentPrice(e: ModelEconomics): number {
  return e.units > 0 ? e.grossRevenue / e.units : 0;
}

/** O valor informado pela usuária só vale ao cruzar R$ 79 de baixo pra cima; quem já vende acima tem a parte fixa medida. */
function usesFreeShippingFixed(e: ModelEconomics, a: PriceAssumptions, atPrice?: number): boolean {
  return (
    a.fixedAboveFreeShipping != null &&
    atPrice !== undefined &&
    atPrice >= ML_FREE_SHIPPING_THRESHOLD &&
    currentPrice(e) < ML_FREE_SHIPPING_THRESHOLD
  );
}

/** Parte fixa por peça, deduzida do que a venda real descontou além do percentual. */
export function fixedCostPerUnit(e: ModelEconomics, a: PriceAssumptions, atPrice?: number): number {
  if (e.units <= 0) return 0;
  const price = currentPrice(e);
  if (usesFreeShippingFixed(e, a, atPrice)) return a.fixedAboveFreeShipping as number;
  const deductionsPerUnit = (e.grossRevenue - e.beforeProductionCost) / e.units;
  return Math.max(0, deductionsPerUnit - (a.taxRate + a.commissionRate) * price);
}

export function adsRate(e: ModelEconomics, a: PriceAssumptions): number {
  return a.includeAds && e.grossRevenue > 0 ? e.adSpend / e.grossRevenue : 0;
}

/** Quanto sobra por peça a um preço, com a alíquota de imposto informada (padrão: a de hoje). */
export function breakdownAt(e: ModelEconomics, a: PriceAssumptions, price: number, taxRate = a.taxRate): UnitBreakdown {
  const tax = taxRate * price;
  const commission = a.commissionRate * price;
  const fixedPerUnit = fixedCostPerUnit(e, a, price);
  const ads = adsRate(e, a) * price;
  const contribution = price - tax - commission - fixedPerUnit - ads - e.unitCost;
  return {
    price,
    tax,
    commission,
    fixedPerUnit,
    ads,
    productionCost: e.unitCost,
    contribution,
    marginPercent: price > 0 ? contribution / price : 0,
  };
}

export function currentBreakdown(e: ModelEconomics, a: PriceAssumptions): UnitBreakdown {
  return breakdownAt(e, a, currentPrice(e));
}

/**
 * Preço pra margem final `target` (fração). null quando nem um preço infinito
 * chega lá — imposto + comissão + Ads + meta já passam de ~98% do preço.
 */
export function priceForMargin(e: ModelEconomics, a: PriceAssumptions, target: number, taxRate = a.taxRate): number | null {
  const share = 1 - taxRate - a.commissionRate - adsRate(e, a) - target;
  if (share <= 0.02) return null;
  const price = (fixedCostPerUnit(e, a) + e.unitCost) / share;
  if (a.fixedAboveFreeShipping == null || currentPrice(e) >= ML_FREE_SHIPPING_THRESHOLD || price < ML_FREE_SHIPPING_THRESHOLD) return price;
  // Passaria de R$ 79: vale a parte fixa informada pra esse patamar. Se mesmo assim
  // R$ 79 já der a margem, esse é o preço; senão, o preço sai com a parte nova.
  const above = (a.fixedAboveFreeShipping + e.unitCost) / share;
  return Math.max(ML_FREE_SHIPPING_THRESHOLD, above);
}

/**
 * Calculadora rápida, sem venda real: custo da peça, despesas por peça em R$
 * (tarifa fixa, frete, embalagem) e os percentuais sobre o preço.
 */
export type QuickPriceInput = {
  unitCost: number;
  fixedPerUnit: number;
  taxRate: number;
  commissionRate: number;
  adsRate: number;
};

/** Preço pra margem `target` (o "markup divisor"); null se os percentuais já comem o preço todo. */
export function quickPriceFor(i: QuickPriceInput, target: number): number | null {
  const share = 1 - i.taxRate - i.commissionRate - i.adsRate - target;
  if (share <= 0.02) return null;
  return (i.unitCost + i.fixedPerUnit) / share;
}

/** Margem e sobra por peça a um preço. */
export function quickMarginAt(i: QuickPriceInput, price: number): { contribution: number; marginPercent: number } {
  const contribution = price * (1 - i.taxRate - i.commissionRate - i.adsRate) - i.fixedPerUnit - i.unitCost;
  return { contribution, marginPercent: price > 0 ? contribution / price : 0 };
}

/** Markup multiplicador: por quanto multiplicar o custo da peça pra chegar no preço. */
export function markupOf(price: number, unitCost: number): number | null {
  return unitCost > 0 ? price / unitCost : null;
}
