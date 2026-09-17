export type SaleForAggregation = {
  sku: string;
  productName: string;
  quantity: number;
  grossRevenue: number;
  netRevenue: number;
  marketplaceCost: number;
  status: string;
  shippingModality?: string | null;
};

export type SkuSalesAggregate = {
  sku: string;
  name: string;
  quantity: number;
  grossRevenue: number;
  netRevenue: number;
  marketplaceCost: number;
  /** Quantos pedidos desse SKU foram enviados por Flex — cada um cobrado à
   * parte pela transportadora (R$12,99/pacote), fora do que o Mercado Turbo
   * já desconta em netRevenue. */
  flexOrderCount: number;
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

    const isFlex = sale.shippingModality === "Flex";
    const existing = bySku.get(sale.sku);
    if (existing) {
      existing.quantity += sale.quantity;
      existing.grossRevenue += sale.grossRevenue;
      existing.netRevenue += sale.netRevenue;
      existing.marketplaceCost += sale.marketplaceCost;
      existing.flexOrderCount += isFlex ? 1 : 0;
    } else {
      bySku.set(sale.sku, {
        sku: sale.sku,
        name: sale.productName,
        quantity: sale.quantity,
        grossRevenue: sale.grossRevenue,
        netRevenue: sale.netRevenue,
        marketplaceCost: sale.marketplaceCost,
        flexOrderCount: isFlex ? 1 : 0,
      });
    }
  }

  return Array.from(bySku.values());
}

export type SaleForModalityBreakdown = {
  shippingModality?: string | null;
  quantity: number;
  grossRevenue: number;
  netRevenue: number;
};

export type ModalityBreakdown = {
  modality: string;
  count: number;
  quantity: number;
  grossRevenue: number;
  netRevenue: number;
};

/**
 * Agrupa vendas por modalidade de envio (Flex/Full/me2/Shopee Xpress/etc.) —
 * base pra comparar o número de pedidos Flex do período com a fatura real
 * que a transportadora cobra à parte (R$12,99/pacote, fora do que o
 * Mercado Turbo já desconta).
 */
export function groupSalesByModality(sales: SaleForModalityBreakdown[]): ModalityBreakdown[] {
  const byModality = new Map<string, ModalityBreakdown>();

  for (const sale of sales) {
    const modality = sale.shippingModality || "Sem modalidade";
    const existing = byModality.get(modality);
    if (existing) {
      existing.count += 1;
      existing.quantity += sale.quantity;
      existing.grossRevenue += sale.grossRevenue;
      existing.netRevenue += sale.netRevenue;
    } else {
      byModality.set(modality, {
        modality,
        count: 1,
        quantity: sale.quantity,
        grossRevenue: sale.grossRevenue,
        netRevenue: sale.netRevenue,
      });
    }
  }

  return Array.from(byModality.values()).sort((a, b) => b.grossRevenue - a.grossRevenue);
}

export type SaleDateRevenue = { saleDate: Date; grossRevenue: number; netRevenue: number; status: string };

export type RevenueInTransit = {
  fromDay: number;
  salesCount: number;
  grossRevenue: number;
  netRevenue: number;
};

/**
 * Receita de vendas feitas do dia `fromDay` do mês em diante — a fatia com
 * mais chance de o dinheiro só ser liberado (e virar entrada de caixa de
 * verdade) no mês seguinte, mesmo já sendo receita reconhecida no mês da
 * venda. `saleDate` é comparado em UTC, mesma convenção usada no resto do
 * sistema pra datas vindas do banco.
 */
export function computeRevenueInTransit(
  sales: SaleDateRevenue[],
  fromDay: number,
  excludedStatuses: string[] = DEFAULT_EXCLUDED_SALE_STATUSES,
): RevenueInTransit {
  const filtered = sales.filter(
    (s) => !isExcludedSaleStatus(s.status, excludedStatuses) && s.saleDate.getUTCDate() >= fromDay,
  );

  return {
    fromDay,
    salesCount: filtered.length,
    grossRevenue: filtered.reduce((sum, s) => sum + s.grossRevenue, 0),
    netRevenue: filtered.reduce((sum, s) => sum + s.netRevenue, 0),
  };
}
