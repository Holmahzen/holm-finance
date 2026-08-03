import { productRepository } from "@/repositories/productRepository";
import { fixedCostRepository } from "@/repositories/fixedCostRepository";
import { dashboardRepository } from "@/repositories/dashboardRepository";
import { marketplaceSaleRepository } from "@/repositories/marketplaceSaleRepository";
import { breakEvenSettingsService } from "@/services/breakEvenSettingsService";
import {
  computeProductMargin,
  computeSalesBasedMargin,
  computeBreakEven,
  computeEstimatedProfit,
} from "@/domain/breakEven";
import { computeMonthRevenueProjection, computeProjectedBreakEvenDay } from "@/domain/projections";
import { computeInsights } from "@/domain/insights";
import { aggregateSalesBySku } from "@/domain/salesAggregation";

export const breakEvenService = {
  async getReport(year?: number, month?: number) {
    const now = new Date();
    const y = year ?? now.getFullYear();
    const m = month ?? now.getMonth() + 1;
    const monthStart = new Date(y, m - 1, 1);
    const monthEnd = new Date(y, m, 1);

    const [products, sales, fixedCosts, flow, settings, productCosts] = await Promise.all([
      productRepository.findActive(),
      marketplaceSaleRepository.findByPeriod(monthStart, monthEnd),
      fixedCostRepository.findActive(),
      dashboardRepository.getMonthlyFlow(monthStart, monthEnd),
      breakEvenSettingsService.get(),
      productRepository.getProductCostsBySku(),
    ]);

    const productionCostBySku = new Map(productCosts.map((c) => [c.sku, c]));

    const fixedCostsTotal = fixedCosts.reduce((sum, fc) => sum + Number(fc.amount), 0);

    const skuAggregates = aggregateSalesBySku(
      sales.map((s) => ({
        sku: s.sku,
        productName: s.productName,
        quantity: s.quantity,
        grossRevenue: Number(s.grossRevenue),
        netRevenue: Number(s.netRevenue),
        status: s.status,
      })),
    );

    // Quando há vendas importadas no período, elas mandam nos números (dado
    // real, por SKU). Sem vendas nesse mês, cai pro cadastro manual em
    // Produtos, pra tela não ficar vazia em meses ainda sem importação.
    const dataSource: "vendas" | "produtos" = skuAggregates.length > 0 ? "vendas" : "produtos";

    let productionCostMatchedSkus = 0;
    let productionCostUnmatchedSkus = 0;

    const productsWithMargin =
      dataSource === "vendas"
        ? skuAggregates.map((s) => {
            const salePrice = s.quantity > 0 ? s.grossRevenue / s.quantity : 0;
            const productionCost = productionCostBySku.get(s.sku) ?? null;
            if (productionCost) productionCostMatchedSkus++;
            else productionCostUnmatchedSkus++;
            const margin = computeSalesBasedMargin(s, productionCost);
            return {
              id: s.sku,
              name: s.name,
              sku: s.sku,
              salePrice,
              tecidoCost: productionCost?.tecidoCost ?? 0,
              costuraCost: productionCost?.costuraCost ?? 0,
              aviamentosCost: productionCost?.aviamentosCost ?? 0,
              marketplaceFee: 0,
              shippingCost: 0,
              packagingCost: 0,
              avgMonthlyQuantity: s.quantity,
              ...margin,
            };
          })
        : products.map((p) => ({
            ...p,
            ...computeProductMargin(p),
          }));

    const actualRevenueThisMonth =
      dataSource === "vendas"
        ? skuAggregates.reduce((sum, s) => sum + s.grossRevenue, 0)
        : Number(flow.inflow);

    const ranked = [...productsWithMargin].sort((a, b) => b.marginPercent - a.marginPercent);
    const top10 = ranked.slice(0, 10);
    const bottom10 = ranked.slice(-10).reverse();

    const breakEven = computeBreakEven(productsWithMargin, fixedCostsTotal);

    const marginAlertThreshold = Number(settings.marginAlertThreshold);
    const alert =
      breakEven.weightedMarginPercent !== null &&
      breakEven.weightedMarginPercent * 100 < marginAlertThreshold;

    const progress =
      breakEven.breakEvenRevenue !== null
        ? actualRevenueThisMonth - breakEven.breakEvenRevenue
        : null;

    const estimatedProfit = computeEstimatedProfit(
      actualRevenueThisMonth,
      breakEven.weightedMarginPercent,
      fixedCostsTotal,
    );

    const negativeMarginProducts = productsWithMargin
      .filter((p) => p.marginValue < 0)
      .map((p) => ({ name: p.name }));

    const isCurrentPeriod = y === now.getFullYear() && m === now.getMonth() + 1;
    const daysInMonth = new Date(y, m, 0).getDate();
    const daysElapsed = isCurrentPeriod ? now.getDate() : 0;

    const projection = isCurrentPeriod
      ? computeMonthRevenueProjection(actualRevenueThisMonth, daysElapsed, daysInMonth)
      : null;

    const projectedBreakEvenDay = projection
      ? computeProjectedBreakEvenDay(breakEven.breakEvenRevenue, projection.dailyPace, daysInMonth)
      : null;

    const insights = computeInsights({
      weightedMarginPercent: breakEven.weightedMarginPercent,
      marginAlertThreshold,
      breakEvenRevenue: breakEven.breakEvenRevenue,
      progress,
      estimatedProfit,
      negativeMarginProducts,
      projection,
      projectedBreakEvenDay,
    });

    return {
      period: { year: y, month: m },
      fixedCostsTotal,
      actualRevenueThisMonth,
      breakEven,
      progress,
      estimatedProfit,
      top10,
      bottom10,
      marginAlertThreshold,
      alert,
      negativeMarginProductsCount: negativeMarginProducts.length,
      projection,
      projectedBreakEvenDay,
      insights,
      dataSource,
      productionCostMatchedSkus: dataSource === "vendas" ? productionCostMatchedSkus : null,
      productionCostUnmatchedSkus: dataSource === "vendas" ? productionCostUnmatchedSkus : null,
    };
  },
};
