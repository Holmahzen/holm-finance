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
import { computeMonthRevenueProjectionWithFallback, computeProjectedBreakEvenDay } from "@/domain/projections";
import { computeInsights } from "@/domain/insights";
import { aggregateSalesBySku } from "@/domain/salesAggregation";
import { computeDaysRemainingInMonth, computeDailyGoal } from "@/domain/cashReserve";
import { computeFixedCostMonthlyAmount } from "@/domain/fixedCostSchedule";
import { todayUTCInBrazil } from "@/lib/today";

const MARGIN_BASE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

type SaleRow = Awaited<ReturnType<typeof marketplaceSaleRepository.findByPeriod>>[number];

function toAggregateInput(sales: SaleRow[]) {
  return sales.map((s) => ({
    sku: s.sku,
    productName: s.productName,
    quantity: s.quantity,
    grossRevenue: Number(s.grossRevenue),
    netRevenue: Number(s.netRevenue),
    marketplaceCost: Number(s.marketplaceCost),
    status: s.status,
    shippingModality: s.shippingModality,
  }));
}

/**
 * Ritmo diário da janela-base. Divide pelos dias que de fato têm venda
 * importada (do início da janela até a última venda), não pelos 30 — se a
 * última importação foi há uma semana, dividir por 30 subestimaria o ritmo.
 */
function dailyPaceOf(sales: SaleRow[], revenue: number, start: Date): number | null {
  if (sales.length === 0) return null;
  const lastSale = Math.max(...sales.map((s) => s.saleDate.getTime()));
  const coveredDays = Math.min(MARGIN_BASE_DAYS, Math.max(1, Math.floor((lastSale - start.getTime()) / DAY_MS) + 1));
  return revenue / coveredDays;
}

export const breakEvenService = {
  async getReport(year?: number, month?: number) {
    const now = todayUTCInBrazil();
    const y = year ?? now.getUTCFullYear();
    const m = month ?? now.getUTCMonth() + 1;
    const monthStart = new Date(y, m - 1, 1);
    const monthEnd = new Date(y, m, 1);
    const isCurrentPeriod = y === now.getUTCFullYear() && m === now.getUTCMonth() + 1;

    // A margem e o mix de produtos saem de uma janela que represente um mês
    // de venda: no mês corrente, os últimos 30 dias completos (no dia 2 o mês
    // tem 1–2 dias de venda, e a margem e o "lucro estimado" saíam disso); em
    // mês passado, o próprio mês.
    const marginBaseStart = isCurrentPeriod ? new Date(now.getTime() - MARGIN_BASE_DAYS * DAY_MS) : monthStart;
    const marginBaseEnd = isCurrentPeriod ? now : monthEnd;

    const [products, monthSales, baseSales, fixedCosts, flow, settings, productCosts] = await Promise.all([
      productRepository.findActive(),
      marketplaceSaleRepository.findByPeriod(monthStart, monthEnd),
      isCurrentPeriod ? marketplaceSaleRepository.findByPeriod(marginBaseStart, marginBaseEnd) : null,
      fixedCostRepository.findActive(),
      dashboardRepository.getMonthlyFlow(monthStart, monthEnd),
      breakEvenSettingsService.get(),
      productRepository.getProductCostsBySku(),
    ]);

    const productionCostBySku = new Map(productCosts.map((c) => [c.sku, c]));

    // Soma pelo valor mensal de fato (não o valor bruto por ocorrência) —
    // um custo semanal/quinzenal custa mais de uma vez por mês.
    const fixedCostsTotal = fixedCosts.reduce(
      (sum, fc) => sum + computeFixedCostMonthlyAmount({ ...fc, amount: Number(fc.amount) }, y, m),
      0,
    );

    const sales = baseSales ?? monthSales;
    const skuAggregates = aggregateSalesBySku(toAggregateInput(sales));

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
              packagingCost: productionCost?.packagingCost ?? 0,
              avgMonthlyQuantity: s.quantity,
              ...margin,
            };
          })
        : products.map((p) => ({
            ...p,
            ...computeProductMargin(p),
          }));

    const monthAggregates = baseSales ? aggregateSalesBySku(toAggregateInput(monthSales)) : skuAggregates;
    const actualRevenueThisMonth =
      dataSource === "vendas"
        ? monthAggregates.reduce((sum, s) => sum + s.grossRevenue, 0)
        : Number(flow.inflow);
    const marginBaseRevenue = skuAggregates.reduce((sum, s) => sum + s.grossRevenue, 0);

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

    const negativeMarginProducts = productsWithMargin
      .filter((p) => p.marginValue < 0)
      .map((p) => ({ name: p.name }));

    const daysInMonth = new Date(y, m, 0).getDate();
    const daysElapsed = isCurrentPeriod ? now.getUTCDate() : 0;

    const projection = isCurrentPeriod
      ? computeMonthRevenueProjectionWithFallback(
          actualRevenueThisMonth,
          daysElapsed,
          daysInMonth,
          baseSales && dataSource === "vendas" ? dailyPaceOf(baseSales, marginBaseRevenue, marginBaseStart) : null,
        )
      : null;

    // Mês corrente: lucro do mês inteiro, pelo faturamento projetado — e não
    // o faturado até hoje contra o custo fixo do mês todo, que dá prejuízo
    // em qualquer começo de mês.
    const estimatedProfit = computeEstimatedProfit(
      projection?.projectedRevenue ?? actualRevenueThisMonth,
      breakEven.weightedMarginPercent,
      fixedCostsTotal,
    );

    const projectedBreakEvenDay = projection
      ? computeProjectedBreakEvenDay(breakEven.breakEvenRevenue, projection.dailyPace, daysInMonth)
      : null;

    // Meta diária de faturamento: quanto falta pra bater o ponto de
    // equilíbrio, dividido pelos dias que restam no mês corrente. Só faz
    // sentido pro período atual (mês fechado não tem "dias restantes").
    const daysRemainingInMonth = isCurrentPeriod
      ? computeDaysRemainingInMonth(y, m, now.getUTCDate())
      : null;
    const remainingToBreakEven =
      breakEven.breakEvenRevenue !== null
        ? Math.max(0, breakEven.breakEvenRevenue - actualRevenueThisMonth)
        : null;
    const dailyRevenueGoal =
      isCurrentPeriod && daysRemainingInMonth !== null && remainingToBreakEven !== null
        ? computeDailyGoal(remainingToBreakEven, daysRemainingInMonth)
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
      daysRemainingInMonth,
      dailyRevenueGoal,
      insights,
      dataSource,
      marginBase: baseSales
        ? { kind: "ultimos30dias" as const, start: marginBaseStart.toISOString(), end: marginBaseEnd.toISOString() }
        : { kind: "mes" as const, start: monthStart.toISOString(), end: monthEnd.toISOString() },
      productionCostMatchedSkus: dataSource === "vendas" ? productionCostMatchedSkus : null,
      productionCostUnmatchedSkus: dataSource === "vendas" ? productionCostUnmatchedSkus : null,
    };
  },
};
