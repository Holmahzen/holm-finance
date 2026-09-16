import { marketplaceSaleRepository } from "@/repositories/marketplaceSaleRepository";
import { productRepository } from "@/repositories/productRepository";
import { dreService } from "@/services/dreService";
import { aggregateSalesBySku } from "@/domain/salesAggregation";
import { buildProfitabilityReport } from "@/domain/productProfitability";
import type { ProductInput } from "@/domain/breakEven";

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

    const [sales, products, periodResult] = await Promise.all([
      marketplaceSaleRepository.findByPeriod(start, end),
      productRepository.findActive(),
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
      })),
    );

    const productBySku = new Map<string, ProductInput>(
      products.filter((p) => p.sku).map((p) => [p.sku!, p]),
    );

    const { rows, suggestedMarginThreshold } = buildProfitabilityReport(skus, productBySku, marginThreshold);

    return { year, month: month ?? null, rows, suggestedMarginThreshold, periodResult };
  },
};
