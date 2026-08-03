import type { Prisma } from "@/generated/prisma/client";

type Numeric = string | number | Prisma.Decimal;

export type ProductInput = {
  salePrice: Numeric;
  tecidoCost: Numeric;
  costuraCost: Numeric;
  aviamentosCost: Numeric;
  marketplaceFee: Numeric;
  shippingCost: Numeric;
  packagingCost: Numeric;
  avgMonthlyQuantity: number;
};

export type ProductMargin = {
  variableCost: number;
  marginValue: number;
  /** Margem sobre o preço: (preço - custo) / preço. */
  marginPercent: number;
  /** Markup sobre o custo: (preço - custo) / custo — "multiplico o custo por quanto pra chegar no preço". */
  markupPercent: number;
};

export function computeProductMargin(product: ProductInput): ProductMargin {
  const salePrice = Number(product.salePrice);
  const variableCost =
    Number(product.tecidoCost) +
    Number(product.costuraCost) +
    Number(product.aviamentosCost) +
    Number(product.marketplaceFee) +
    Number(product.shippingCost) +
    Number(product.packagingCost);
  const marginValue = salePrice - variableCost;
  const marginPercent = salePrice > 0 ? marginValue / salePrice : 0;
  const markupPercent = variableCost > 0 ? marginValue / variableCost : 0;

  return { variableCost, marginValue, marginPercent, markupPercent };
}

export type SkuSalesInput = {
  quantity: number;
  grossRevenue: number;
  netRevenue: number;
};

export type ProductionCost = {
  tecidoCost: number;
  costuraCost: number;
  aviamentosCost: number;
};

/**
 * Margem de contribuição de um SKU a partir de vendas reais (Mercado Turbo):
 * netRevenue já vem líquido de comissão do marketplace/logística, então só
 * falta descontar o custo de produção (tecido/costura/aviamentos) por peça,
 * que o marketplace não tem como saber — é o mesmo custo cadastrado em
 * Produtos e usado na DRE (custo das peças vendidas).
 */
export function computeSalesBasedMargin(
  sale: SkuSalesInput,
  productionCost: ProductionCost | null,
): ProductMargin {
  const salePrice = sale.quantity > 0 ? sale.grossRevenue / sale.quantity : 0;
  const productionCostPerUnit = productionCost
    ? productionCost.tecidoCost + productionCost.costuraCost + productionCost.aviamentosCost
    : 0;
  const marginValue =
    sale.quantity > 0 ? sale.netRevenue / sale.quantity - productionCostPerUnit : 0;
  const marginPercent = salePrice > 0 ? marginValue / salePrice : 0;
  const variableCost = salePrice - marginValue;
  const markupPercent = variableCost > 0 ? marginValue / variableCost : 0;

  return { variableCost, marginValue, marginPercent, markupPercent };
}

export type BreakEvenResult = {
  totalRevenue: number;
  totalContribution: number;
  totalQty: number;
  weightedMarginPercent: number | null;
  /** Markup médio ponderado: contribuição total / custo variável total. */
  weightedMarkupPercent: number | null;
  breakEvenRevenue: number | null;
  weightedAvgUnitMargin: number | null;
  breakEvenUnits: number | null;
};

export type BreakEvenTargets = {
  breakEvenRevenue: number | null;
  breakEvenUnits: number | null;
};

/**
 * Aplica um custo fixo (real ou hipotético) sobre uma margem já calculada,
 * sem precisar da lista de produtos. É o que dá pra reaproveitar num
 * simulador "e se o custo fixo fosse outro", já que a margem/ritmo de venda
 * não mudam com o custo fixo.
 */
export function computeBreakEvenTargets(
  fixedCostsTotal: number,
  weightedMarginPercent: number | null,
  weightedAvgUnitMargin: number | null,
): BreakEvenTargets {
  const breakEvenRevenue =
    weightedMarginPercent !== null && weightedMarginPercent > 0
      ? fixedCostsTotal / weightedMarginPercent
      : null;

  const breakEvenUnits =
    weightedAvgUnitMargin !== null && weightedAvgUnitMargin > 0
      ? fixedCostsTotal / weightedAvgUnitMargin
      : null;

  return { breakEvenRevenue, breakEvenUnits };
}

export function computeBreakEven(
  products: (ProductInput & ProductMargin)[],
  fixedCostsTotal: number,
): BreakEvenResult {
  let totalRevenue = 0;
  let totalContribution = 0;
  let totalQty = 0;
  let totalVariableCost = 0;

  for (const p of products) {
    const qty = p.avgMonthlyQuantity;
    totalRevenue += Number(p.salePrice) * qty;
    totalContribution += p.marginValue * qty;
    totalVariableCost += p.variableCost * qty;
    totalQty += qty;
  }

  const weightedMarginPercent = totalRevenue > 0 ? totalContribution / totalRevenue : null;
  const weightedMarkupPercent = totalVariableCost > 0 ? totalContribution / totalVariableCost : null;
  const weightedAvgUnitMargin = totalQty > 0 ? totalContribution / totalQty : null;
  const { breakEvenRevenue, breakEvenUnits } = computeBreakEvenTargets(
    fixedCostsTotal,
    weightedMarginPercent,
    weightedAvgUnitMargin,
  );

  return {
    totalRevenue,
    totalContribution,
    totalQty,
    weightedMarginPercent,
    weightedMarkupPercent,
    breakEvenRevenue,
    weightedAvgUnitMargin,
    breakEvenUnits,
  };
}

/**
 * Lucro estimado do período = contribuição gerada pelo faturamento real
 * (faturamento × margem de contribuição média) menos os custos fixos.
 * Positivo = lucro, negativo = prejuízo. `null` quando não há margem
 * calculável ainda (sem produtos/quantidade cadastrados).
 */
export function computeEstimatedProfit(
  actualRevenue: number,
  weightedMarginPercent: number | null,
  fixedCostsTotal: number,
): number | null {
  if (weightedMarginPercent === null) return null;
  return actualRevenue * weightedMarginPercent - fixedCostsTotal;
}
