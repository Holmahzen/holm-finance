import { formatBRL } from "@/lib/format";

export type BreakEvenInsight =
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

export function breakEvenInsightText(insight: BreakEvenInsight): string {
  switch (insight.type) {
    case "margin_below_threshold":
      return `Margem de contribuição média (${(insight.marginPercent * 100).toFixed(1)}%) está abaixo do limite de alerta que você definiu (${insight.threshold}%).`;
    case "negative_margin_products": {
      const names = insight.sampleNames.join(", ");
      const extra = insight.count > insight.sampleNames.length ? ` e mais ${insight.count - insight.sampleNames.length}` : "";
      return `${insight.count} produto(s) com margem de contribuição negativa: ${names}${extra}. Cada venda desses produtos gera prejuízo — revise preço ou custo em Produtos.`;
    }
    case "negative_estimated_profit":
      return `O lucro estimado do período está negativo (${formatBRL(insight.estimatedProfit)}) — os custos fixos ainda não estão sendo cobertos pela margem gerada pelo faturamento atual.`;
    case "projection_below_break_even":
      return `No ritmo atual de vendas, a projeção é fechar o mês em ${formatBRL(insight.projectedRevenue)} — abaixo do ponto de equilíbrio (${formatBRL(insight.breakEvenRevenue)}).`;
    case "break_even_reached":
      return `Ponto de equilíbrio já superado neste período, com excedente de ${formatBRL(insight.surplus)}.`;
    case "projection_above_break_even":
      return `No ritmo atual de vendas, a projeção é fechar o mês em ${formatBRL(insight.projectedRevenue)}, superando o ponto de equilíbrio (${formatBRL(insight.breakEvenRevenue)}).`;
    case "projected_break_even_day":
      return `No ritmo atual, você deve bater o ponto de equilíbrio por volta do dia ${insight.day}.`;
  }
}

export const BREAK_EVEN_SEVERITY_STYLE: Record<BreakEvenInsight["severity"], string> = {
  critical: "border-red-400/40 bg-red-400/10 text-red-400",
  warning: "border-amber-400/40 bg-amber-400/10 text-amber-400",
  info: "border-sky-400/40 bg-sky-400/10 text-sky-400",
};

export const BREAK_EVEN_SEVERITY_LABEL: Record<BreakEvenInsight["severity"], string> = {
  critical: "Alerta",
  warning: "Atenção",
  info: "Análise",
};
