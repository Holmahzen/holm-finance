import { computeProductMargin, type ProductInput, type ProductMargin } from "@/domain/breakEven";
import type { SkuSalesAggregate } from "@/domain/salesAggregation";

/**
 * Cruza duas perguntas que hoje o sistema só responde separado: "quem vende
 * mais" (Prioridade de cadastro, só receita) e "quem dá lucro" (tabela de
 * Produtos, só quem já tem custo). Junto, isso vira uma ferramenta de decisão:
 * onde proteger, onde ajustar preço, onde investir, e o que descontinuar.
 */

export type AbcTier = "A" | "B" | "C";

/** Corte clássico de curva ABC: A cobre até 80% da receita acumulada, B até 95%. */
export const ABC_THRESHOLDS: { tier: AbcTier; upTo: number }[] = [
  { tier: "A", upTo: 0.8 },
  { tier: "B", upTo: 0.95 },
  { tier: "C", upTo: 1 },
];

export type SkuAbc = SkuSalesAggregate & {
  revenueShare: number;
  cumulativeShare: number;
  tier: AbcTier;
};

/** Ordena por receita bruta e marca a classe A/B/C pela % acumulada — mesma ideia da Prioridade de cadastro, mas para o catálogo inteiro, não só os sem custo. */
export function classifyAbc(skus: SkuSalesAggregate[]): SkuAbc[] {
  const total = skus.reduce((sum, s) => sum + s.grossRevenue, 0);
  const sorted = [...skus].sort((a, b) => b.grossRevenue - a.grossRevenue);

  let cumulative = 0;
  return sorted.map((s, index) => {
    const revenueShare = total > 0 ? s.grossRevenue / total : 0;
    cumulative += revenueShare;
    // O campeão de vendas é sempre classe A, mesmo se ele sozinho já passar
    // de 80% (catálogo pequeno, ou um produto muito dominante) — nesse caso o
    // acumulado ultrapassa o corte na primeira linha, e sem essa garantia ele
    // viraria classe C, o oposto do que a curva ABC quer dizer.
    const tier = index === 0 ? "A" : (ABC_THRESHOLDS.find((t) => cumulative <= t.upTo + 1e-9)?.tier ?? "C");
    return { ...s, revenueShare, cumulativeShare: cumulative, tier };
  });
}

export type ProfitabilityQuadrant = "ESTRELA" | "MOTOR_MARGEM_APERTADA" | "NICHO_RENTAVEL" | "REAVALIAR" | "SEM_CUSTO";

export const QUADRANT_LABEL: Record<ProfitabilityQuadrant, string> = {
  ESTRELA: "Estrela",
  MOTOR_MARGEM_APERTADA: "Motor de volume, margem apertada",
  NICHO_RENTAVEL: "Nicho rentável",
  REAVALIAR: "Reavaliar",
  SEM_CUSTO: "Sem custo cadastrado",
};

/**
 * A vende muito; B/C vende pouco (cauda longa). marginThreshold decide o que
 * conta como "margem boa" — não é um número universal, por isso fica
 * ajustável na tela em vez de fixo aqui (o padrão sugerido é a mediana do
 * catálogo já custeado, calculada por quem chama).
 */
export function classifyQuadrant(tier: AbcTier, marginPercent: number, hasCost: boolean, marginThreshold: number): ProfitabilityQuadrant {
  if (!hasCost) return "SEM_CUSTO";
  const highVolume = tier === "A";
  const healthyMargin = marginPercent >= marginThreshold;
  if (highVolume && healthyMargin) return "ESTRELA";
  if (highVolume && !healthyMargin) return "MOTOR_MARGEM_APERTADA";
  if (!highVolume && healthyMargin) return "NICHO_RENTAVEL";
  return "REAVALIAR";
}

export type SkuProfitability = SkuAbc & {
  hasCost: boolean;
  marginValue: number;
  marginPercent: number;
  contribution: number;
  /** Investimento em Mercado Ads atribuído a esse SKU no período (soma de
   * todos os anúncios/MLB que venderam esse SKU) — 0 quando não há relatório
   * de Ads importado pro período, ou o SKU nunca apareceu em anúncio nenhum. */
  adSpend: number;
  /** `contribution` já descontando o Ads do período — o número que
   * realmente importa pra saber se o produto dá lucro de verdade. */
  contributionAfterAds: number;
  quadrant: ProfitabilityQuadrant;
};

/** Mediana da margem % entre os produtos já custeados — ponto de partida razoável pro corte "margem boa", ajustável depois na tela. */
export function suggestMarginThreshold(margins: number[]): number {
  if (margins.length === 0) return 0;
  const sorted = [...margins].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function buildProfitabilityReport(
  skus: SkuSalesAggregate[],
  productBySku: Map<string, ProductInput>,
  marginThreshold?: number,
  adSpendBySku: Map<string, number> = new Map(),
): { rows: SkuProfitability[]; suggestedMarginThreshold: number } {
  const abc = classifyAbc(skus);

  const marginBySku = new Map<string, ProductMargin | null>();
  for (const s of abc) {
    const product = productBySku.get(s.sku);
    marginBySku.set(s.sku, product ? computeProductMargin(product) : null);
  }

  const knownMargins = [...marginBySku.values()].filter((m): m is ProductMargin => m !== null).map((m) => m.marginPercent);
  const suggestedMarginThreshold = suggestMarginThreshold(knownMargins);
  const threshold = marginThreshold ?? suggestedMarginThreshold;

  const rows = abc.map((s) => {
    const margin = marginBySku.get(s.sku);
    const hasCost = margin !== null;
    const marginValue = margin?.marginValue ?? 0;
    const marginPercent = margin?.marginPercent ?? 0;
    const contribution = marginValue * s.quantity;
    const adSpend = adSpendBySku.get(s.sku) ?? 0;
    return {
      ...s,
      hasCost,
      marginValue,
      marginPercent,
      contribution,
      adSpend,
      contributionAfterAds: contribution - adSpend,
      quadrant: classifyQuadrant(s.tier, marginPercent, hasCost, threshold),
    };
  });

  return { rows, suggestedMarginThreshold };
}
