import { marketplaceSaleRepository } from "@/repositories/marketplaceSaleRepository";
import { productRepository } from "@/repositories/productRepository";
import { mlAdSpendRepository } from "@/repositories/mlAdSpendRepository";
import { mlFullCostRepository } from "@/repositories/mlFullCostRepository";
import { dreService } from "@/services/dreService";
import { aggregateSalesBySku } from "@/domain/salesAggregation";
import { buildProfitabilityReport } from "@/domain/productProfitability";
import { allocateAdSpendBySku, overlapShare, ownedShareByReport } from "@/domain/adSpendAllocation";

export type PeriodResult = {
  receitaLiquida: number;
  margemContribuicao: number;
  despesasFixasTotal: number;
  resultadoOperacional: number;
  lucroLiquido: number;
};

const EMPTY_PERIOD_RESULT: PeriodResult = {
  receitaLiquida: 0,
  margemContribuicao: 0,
  despesasFixasTotal: 0,
  resultadoOperacional: 0,
  lucroLiquido: 0,
};

function sumPeriodResults(results: PeriodResult[]): PeriodResult {
  return results.reduce(
    (acc, r) => ({
      receitaLiquida: acc.receitaLiquida + r.receitaLiquida,
      margemContribuicao: acc.margemContribuicao + r.margemContribuicao,
      despesasFixasTotal: acc.despesasFixasTotal + r.despesasFixasTotal,
      resultadoOperacional: acc.resultadoOperacional + r.resultadoOperacional,
      lucroLiquido: acc.lucroLiquido + r.lucroLiquido,
    }),
    EMPTY_PERIOD_RESULT,
  );
}

export const productProfitabilityService = {
  /**
   * `month` (1-12) restringe ao mês; sem ele, o ano inteiro — tanto as vendas
   * por SKU quanto o resultado oficial (que soma a DRE dos 12 meses, porque
   * ela só existe mês a mês).
   */
  async getReport(year: number, month?: number, marginThreshold?: number) {
    const start = month ? new Date(year, month - 1, 1) : new Date(year, 0, 1);
    const end = month ? new Date(year, month, 1) : new Date(year + 1, 0, 1);

    const [sales, productCosts, periodResult] = await Promise.all([
      marketplaceSaleRepository.findByPeriod(start, end),
      productRepository.getProductCostsBySku(),
      month
        ? dreService.getDRE(year, month).then((d): PeriodResult => ({
            receitaLiquida: d.receitaLiquida,
            margemContribuicao: d.margemContribuicao,
            despesasFixasTotal: d.despesasFixasTotal,
            resultadoOperacional: d.resultadoOperacional,
            lucroLiquido: d.lucroLiquido,
          }))
        : Promise.all(
            Array.from({ length: 12 }, (_, i) =>
              dreService.getDRE(year, i + 1).then(
                (d): PeriodResult => ({
                  receitaLiquida: d.receitaLiquida,
                  margemContribuicao: d.margemContribuicao,
                  despesasFixasTotal: d.despesasFixasTotal,
                  resultadoOperacional: d.resultadoOperacional,
                  lucroLiquido: d.lucroLiquido,
                }),
              ),
            ),
          ).then(sumPeriodResults),
    ]);

    const skus = aggregateSalesBySku(
      sales.map((s) => ({
        sku: s.sku,
        productName: s.productName,
        quantity: s.quantity,
        grossRevenue: Number(s.grossRevenue),
        netRevenue: Number(s.netRevenue),
        marketplaceCost: Number(s.marketplaceCost),
        status: s.status,
        shippingModality: s.shippingModality,
      })),
    );

    // Margem pela venda real (preço, imposto, tarifa e frete que o Mercado
    // Turbo trouxe, menos o custo de produção cadastrado) — a mesma conta do
    // Ponto de Equilíbrio. Antes usava preço e tarifa digitados em Produtos,
    // que ficam desatualizados e davam margem bem acima da DRE.
    const productionCostBySku = new Map(productCosts.map((c) => [c.sku, c]));

    // Um mesmo anúncio (MLB) costuma vender vários SKUs diferentes no
    // período (variações de tamanho/cor) — o investimento desse anúncio
    // precisa ser dividido entre eles, não jogado inteiro num SKU só.
    const listingCodes = [...new Set(sales.map((s) => s.listingCode).filter((c): c is string => !!c))];
    const adSpendRows = listingCodes.length
      ? await mlAdSpendRepository.findByListingCodesAndPeriod(listingCodes, start, end)
      : [];
    // Relatório exportado com período maior que o consultado (ex.: ago+set
    // olhando só setembro) entra só com a parte dos dias que cai no período.
    const saleShares = sales.map((s) => ({ sku: s.sku, listingCode: s.listingCode, grossRevenue: Number(s.grossRevenue) }));
    // Relatórios com períodos que se repetem (01–17, 01–20, 17–29…) não podem ser somados inteiros.
    const owned = ownedShareByReport(adSpendRows);
    const prorated = adSpendRows.map((r, i) => {
      const share = overlapShare(r.periodStart, r.periodEnd, start, end) * owned[i];
      return { listingCode: r.listingCode, investimento: Number(r.investimento) * share, receita: Number(r.receita) * share };
    });
    const adSpendBySku = allocateAdSpendBySku(saleShares, prorated);
    // A venda atribuída ao Ads é rateada igual ao investimento, então o ACOS
    // de cada SKU é o do anúncio dele.
    const adRevenueBySku = allocateAdSpendBySku(
      saleShares,
      prorated.map((r) => ({ listingCode: r.listingCode, investimento: r.receita })),
    );

    // Custo Full já vem com SKU direto no relatório (diferente do Ads, que só
    // tem MLB) — não precisa de ponte, só soma por SKU no período.
    const knownSkus = skus.map((s) => s.sku);
    const fullCostRows = knownSkus.length
      ? await mlFullCostRepository.findBySkusAndPeriod(knownSkus, start, end)
      : [];
    const fullCostBySku = new Map<string, number>();
    for (const row of fullCostRows) {
      if (!row.sku) continue;
      fullCostBySku.set(row.sku, (fullCostBySku.get(row.sku) ?? 0) + Number(row.amount));
    }

    const { rows, suggestedMarginThreshold } = buildProfitabilityReport(
      skus,
      productionCostBySku,
      marginThreshold,
      adSpendBySku,
      fullCostBySku,
      adRevenueBySku,
    );

    return { year, month: month ?? null, rows, suggestedMarginThreshold, periodResult };
  },
};
