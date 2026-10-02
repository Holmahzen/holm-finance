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

/** Parte fixa por peça, deduzida do que a venda real descontou além do percentual. */
export function fixedCostPerUnit(e: ModelEconomics, a: PriceAssumptions): number {
  if (e.units <= 0) return 0;
  const price = currentPrice(e);
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
  const fixedPerUnit = fixedCostPerUnit(e, a);
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
  return (fixedCostPerUnit(e, a) + e.unitCost) / share;
}
