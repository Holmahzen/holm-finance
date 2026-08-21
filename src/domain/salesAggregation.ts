export type SaleForAggregation = {
  sku: string;
  productName: string;
  quantity: number;
  grossRevenue: number;
  netRevenue: number;
  marketplaceCost: number;
  status: string;
};

export type SkuSalesAggregate = {
  sku: string;
  name: string;
  quantity: number;
  grossRevenue: number;
  netRevenue: number;
  marketplaceCost: number;
};

/**
 * Status que não representam receita real e por isso ficam de fora de todo
 * total/agregação de vendas: pedido cancelado nunca virou dinheiro, e devolução
 * parcial não tem como saber quanto do valor original ainda é receita válida
 * (o Mercado Turbo não informa o valor devolvido, só o valor original da venda).
 */
export const DEFAULT_EXCLUDED_SALE_STATUSES = ["cancelado", "devolução parcial"];

export function isExcludedSaleStatus(
  status: string,
  excludedStatuses: string[] = DEFAULT_EXCLUDED_SALE_STATUSES,
): boolean {
  return excludedStatuses.map((s) => s.trim().toLowerCase()).includes(status.trim().toLowerCase());
}

/**
 * Agrupa vendas por SKU somando quantidade, receita bruta e receita líquida
 * (margem de contribuição já calculada pelo Mercado Turbo). Pedidos com
 * status excluído (cancelado/devolução parcial, por padrão) não entram na
 * soma — contá-los infla receita e margem com vendas que não se concretizaram.
 */
export function aggregateSalesBySku(
  sales: SaleForAggregation[],
  excludedStatuses: string[] = DEFAULT_EXCLUDED_SALE_STATUSES,
): SkuSalesAggregate[] {
  const bySku = new Map<string, SkuSalesAggregate>();

  for (const sale of sales) {
    if (isExcludedSaleStatus(sale.status, excludedStatuses)) continue;

    const existing = bySku.get(sale.sku);
    if (existing) {
      existing.quantity += sale.quantity;
      existing.grossRevenue += sale.grossRevenue;
      existing.netRevenue += sale.netRevenue;
      existing.marketplaceCost += sale.marketplaceCost;
    } else {
      bySku.set(sale.sku, {
        sku: sale.sku,
        name: sale.productName,
        quantity: sale.quantity,
        grossRevenue: sale.grossRevenue,
        netRevenue: sale.netRevenue,
        marketplaceCost: sale.marketplaceCost,
      });
    }
  }

  return Array.from(bySku.values());
}
