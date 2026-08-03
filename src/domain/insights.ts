export type InsightSeverity = "critical" | "warning" | "info";

export type Insight =
  | { type: "margin_below_threshold"; severity: "critical"; marginPercent: number; threshold: number }
  | { type: "negative_margin_products"; severity: "critical"; count: number; sampleNames: string[] }
  | { type: "negative_estimated_profit"; severity: "warning"; estimatedProfit: number }
  | {
      type: "projection_below_break_even";
      severity: "warning";
      projectedRevenue: number;
      breakEvenRevenue: number;
    }
  | { type: "break_even_reached"; severity: "info"; surplus: number }
  | {
      type: "projection_above_break_even";
      severity: "info";
      projectedRevenue: number;
      breakEvenRevenue: number;
    }
  | { type: "projected_break_even_day"; severity: "info"; day: number };

export type InsightsInput = {
  weightedMarginPercent: number | null;
  marginAlertThreshold: number;
  breakEvenRevenue: number | null;
  progress: number | null;
  estimatedProfit: number | null;
  negativeMarginProducts: { name: string }[];
  projection: { projectedRevenue: number } | null;
  projectedBreakEvenDay: number | null;
};

const SEVERITY_RANK: Record<InsightSeverity, number> = { critical: 0, warning: 1, info: 2 };

export function computeInsights(input: InsightsInput): Insight[] {
  const insights: Insight[] = [];

  if (
    input.weightedMarginPercent !== null &&
    input.weightedMarginPercent * 100 < input.marginAlertThreshold
  ) {
    insights.push({
      type: "margin_below_threshold",
      severity: "critical",
      marginPercent: input.weightedMarginPercent,
      threshold: input.marginAlertThreshold,
    });
  }

  if (input.negativeMarginProducts.length > 0) {
    insights.push({
      type: "negative_margin_products",
      severity: "critical",
      count: input.negativeMarginProducts.length,
      sampleNames: input.negativeMarginProducts.slice(0, 3).map((p) => p.name),
    });
  }

  if (input.estimatedProfit !== null && input.estimatedProfit < 0) {
    insights.push({
      type: "negative_estimated_profit",
      severity: "warning",
      estimatedProfit: input.estimatedProfit,
    });
  }

  if (input.progress !== null && input.breakEvenRevenue !== null) {
    if (input.progress >= 0) {
      insights.push({ type: "break_even_reached", severity: "info", surplus: input.progress });
    } else if (input.projection) {
      if (input.projection.projectedRevenue >= input.breakEvenRevenue) {
        insights.push({
          type: "projection_above_break_even",
          severity: "info",
          projectedRevenue: input.projection.projectedRevenue,
          breakEvenRevenue: input.breakEvenRevenue,
        });
      } else {
        insights.push({
          type: "projection_below_break_even",
          severity: "warning",
          projectedRevenue: input.projection.projectedRevenue,
          breakEvenRevenue: input.breakEvenRevenue,
        });
      }
    }
  }

  if (input.projectedBreakEvenDay !== null) {
    insights.push({
      type: "projected_break_even_day",
      severity: "info",
      day: input.projectedBreakEvenDay,
    });
  }

  return insights.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}
