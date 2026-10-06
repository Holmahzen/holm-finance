import { FLEX_COST_PER_PACKAGE, type ProductionCost } from "@/domain/breakEven";
import { aggregateSalesBySku, type SaleForAggregation } from "@/domain/salesAggregation";
import { rowKind } from "@/domain/fiscalNotes";
import { normalizeKey } from "@/domain/productModels";
import type { ProductMovementRow } from "@/domain/productReturns";

/**
 * Margem de contribuição por canal de venda. Cada canal tem a sua fonte:
 * - Mercado Livre: relatório do Mercado Turbo, que já desconta imposto,
 *   tarifa e frete (mesma conta da Lucratividade), menos Flex, Ads e Full;
 * - Shopee: relatório do Mercado Turbo da Shopee, que também já desconta
 *   imposto, tarifa e frete;
 * - Atacado e venda direta: notas fiscais de venda sem intermediador — não
 *   tem tarifa de marketplace; desconta imposto e custo de produção. Frete e
 *   comissão de vendedor, se houver, não aparecem na nota e ficam de fora.
 * Devoluções não entram (ver a tela de Devoluções).
 */

export type ChannelKey = "mercadoLivre" | "shopee" | "direta";

export type ChannelProduct = {
  sku: string;
  name: string;
  quantity: number;
  revenue: number;
  hasCost: boolean;
  contribution: number;
  marginPercent: number | null;
};

export type ChannelMargin = {
  key: ChannelKey;
  label: string;
  source: string;
  revenue: number;
  quantity: number;
  /** Receita dos itens com custo cadastrado — base da margem. */
  costedRevenue: number;
  tax: number;
  marketplaceFees: number;
  productionCost: number;
  ads: number;
  fullCost: number;
  contribution: number;
  /** Contribuição ÷ receita dos itens com custo; null sem item custeado. */
  marginPercent: number | null;
  /** Fração da receita que tem custo cadastrado (0–1). */
  costCoverage: number;
  products: ChannelProduct[];
};

const unitCostOf = (c: ProductionCost) => c.tecidoCost + c.costuraCost + c.aviamentosCost + (c.packagingCost ?? 0);

function costLookup(costs: Map<string, ProductionCost>) {
  const normalized = new Map<string, ProductionCost>();
  for (const [sku, c] of costs) normalized.set(normalizeKey(sku), c);
  return (sku: string) => normalized.get(normalizeKey(sku)) ?? null;
}

function finish(
  base: Omit<ChannelMargin, "marginPercent" | "costCoverage" | "products" | "contribution">,
  products: ChannelProduct[],
): ChannelMargin {
  const contribution = products.filter((p) => p.hasCost).reduce((s, p) => s + p.contribution, 0) - base.ads - base.fullCost;
  return {
    ...base,
    contribution,
    marginPercent: base.costedRevenue > 0 ? contribution / base.costedRevenue : null,
    costCoverage: base.revenue > 0 ? base.costedRevenue / base.revenue : 0,
    products: products.sort((a, b) => b.revenue - a.revenue),
  };
}

/**
 * Canal de marketplace pelo relatório do Mercado Turbo. `taxRate` só para
 * relatório que não traga o imposto descontado (0 quando já vem descontado).
 */
export function marketplaceChannel(
  key: "mercadoLivre" | "shopee",
  sales: SaleForAggregation[],
  costs: Map<string, ProductionCost>,
  taxRate: number,
  ads = 0,
  fullCost = 0,
): ChannelMargin {
  const costOf = costLookup(costs);
  let tax = 0;
  let fees = 0;
  let productionCost = 0;
  let costedRevenue = 0;
  const products = aggregateSalesBySku(sales).map((s): ChannelProduct => {
    const cost = costOf(s.sku);
    const skuTax = s.grossRevenue * taxRate;
    const flex = s.flexOrderCount * FLEX_COST_PER_PACKAGE;
    const afterFees = s.netRevenue + s.marketplaceCost - flex - skuTax;
    fees += s.grossRevenue - (s.netRevenue + s.marketplaceCost) + flex;
    tax += skuTax;
    const production = cost ? unitCostOf(cost) * s.quantity : 0;
    if (cost) {
      productionCost += production;
      costedRevenue += s.grossRevenue;
    }
    const contribution = afterFees - production;
    return {
      sku: s.sku,
      name: s.name,
      quantity: s.quantity,
      revenue: s.grossRevenue,
      hasCost: cost !== null,
      contribution,
      marginPercent: cost && s.grossRevenue > 0 ? contribution / s.grossRevenue : null,
    };
  });
  return finish(
    {
      key,
      label: key === "shopee" ? "Shopee" : "Mercado Livre",
      source:
        key === "shopee"
          ? "Relatório da Shopee (Mercado Turbo), já com imposto; menos o custo de produção"
          : "Relatório do Mercado Livre (Mercado Turbo), já com imposto; menos Flex, Ads e Full",
      revenue: products.reduce((s, p) => s + p.revenue, 0),
      quantity: products.reduce((s, p) => s + p.quantity, 0),
      costedRevenue,
      tax,
      // No Mercado Livre o imposto vem dentro do que o Mercado Turbo desconta.
      marketplaceFees: fees,
      productionCost,
      ads,
      fullCost,
    },
    products,
  );
}

/** Atacado e venda direta: itens de nota fiscal de venda sem intermediador. */
export function directSalesChannel(rows: ProductMovementRow[], costs: Map<string, ProductionCost>, taxRate: number): ChannelMargin {
  const costOf = costLookup(costs);
  const bySku = new Map<string, { sku: string; name: string; quantity: number; revenue: number }>();
  for (const row of rows) {
    if (row.cancelled || row.intermediaryDocument || rowKind(row) !== "sale") continue;
    const sku = row.productCode.trim().toUpperCase();
    const key = normalizeKey(sku);
    const acc = bySku.get(key) ?? { sku, name: row.description, quantity: 0, revenue: 0 };
    acc.quantity += row.quantity;
    acc.revenue += row.netValue;
    bySku.set(key, acc);
  }

  let productionCost = 0;
  let costedRevenue = 0;
  const products = [...bySku.values()].map((s): ChannelProduct => {
    const cost = costOf(s.sku);
    const production = cost ? unitCostOf(cost) * s.quantity : 0;
    if (cost) {
      productionCost += production;
      costedRevenue += s.revenue;
    }
    const contribution = s.revenue * (1 - taxRate) - production;
    return {
      sku: s.sku,
      name: s.name,
      quantity: s.quantity,
      revenue: s.revenue,
      hasCost: cost !== null,
      contribution,
      marginPercent: cost && s.revenue > 0 ? contribution / s.revenue : null,
    };
  });
  const revenue = products.reduce((s, p) => s + p.revenue, 0);
  return finish(
    {
      key: "direta",
      label: "Atacado e venda direta",
      source: "Notas fiscais de venda sem intermediador; imposto pela alíquota do DAS; sem frete nem comissão",
      revenue,
      quantity: products.reduce((s, p) => s + p.quantity, 0),
      costedRevenue,
      tax: revenue * taxRate,
      marketplaceFees: 0,
      productionCost,
      ads: 0,
      fullCost: 0,
    },
    products,
  );
}
