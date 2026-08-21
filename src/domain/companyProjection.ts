export type RevenueProfitProjection = {
  days: number;
  dailyRevenuePace: number;
  projectedRevenue: number;
  dailyTargetPace: number | null;
  targetRevenue: number | null;
  /** projectedRevenue - targetRevenue (positivo = deve superar a meta). */
  progressVsTarget: number | null;
  dailyProfitPace: number | null;
  projectedProfit: number | null;
};

/**
 * Projeta faturamento e lucro dos próximos N dias, extrapolando o ritmo
 * diário de vendas do mês corrente (mesmo `dailyPace` já usado na projeção
 * de fechamento do mês em Ponto de Equilíbrio) — uma simplificação
 * deliberada (assume ritmo constante, sem sazonalidade) que serve como
 * estimativa direcional, não como previsão precisa.
 */
export function computeRevenueProfitProjection(params: {
  days: number;
  dailyRevenuePace: number;
  weightedMarginPercent: number | null;
  dailyFixedCost: number;
  dailyTargetPace: number | null;
}): RevenueProfitProjection {
  const { days, dailyRevenuePace, weightedMarginPercent, dailyFixedCost, dailyTargetPace } = params;

  const projectedRevenue = dailyRevenuePace * days;
  const targetRevenue = dailyTargetPace !== null ? dailyTargetPace * days : null;
  const progressVsTarget = targetRevenue !== null ? projectedRevenue - targetRevenue : null;

  const dailyProfitPace =
    weightedMarginPercent !== null ? dailyRevenuePace * weightedMarginPercent - dailyFixedCost : null;
  const projectedProfit = dailyProfitPace !== null ? dailyProfitPace * days : null;

  return {
    days,
    dailyRevenuePace,
    projectedRevenue,
    dailyTargetPace,
    targetRevenue,
    progressVsTarget,
    dailyProfitPace,
    projectedProfit,
  };
}
