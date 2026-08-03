import { formatBRL } from "@/lib/format";

export type HealthSignal =
  | { type: "revenue_declining"; severity: "warning"; months: number }
  | { type: "revenue_growing"; severity: "info"; months: number }
  | { type: "loss_streak"; severity: "critical" | "warning"; months: number }
  | { type: "profit_streak"; severity: "info"; months: number }
  | { type: "margin_declining"; severity: "warning"; fromPercent: number; toPercent: number }
  | { type: "margin_improving"; severity: "info"; fromPercent: number; toPercent: number }
  | {
      type: "fixed_costs_outpacing_revenue";
      severity: "warning";
      fixedCostsGrowthPercent: number;
      revenueGrowthPercent: number;
      fixedCostsDelta: number;
      revenueDelta: number;
      topCategories: { name: string; delta: number }[];
    }
  | { type: "cash_declining"; severity: "warning"; months: number }
  | { type: "cash_growing"; severity: "info"; months: number };

export function healthSignalText(s: HealthSignal): string {
  switch (s.type) {
    case "revenue_declining":
      return `Receita líquida caindo há ${s.months} meses seguidos.`;
    case "revenue_growing":
      return `Receita líquida crescendo há ${s.months} meses seguidos.`;
    case "loss_streak":
      return s.months === 1
        ? "O último mês fechou no prejuízo."
        : `Prejuízo em ${s.months} meses seguidos.`;
    case "profit_streak":
      return `Lucro positivo há ${s.months} meses seguidos.`;
    case "margin_declining":
      return `Margem de contribuição caiu de ${s.fromPercent.toFixed(1)}% pra ${s.toPercent.toFixed(1)}% (média dos últimos 3 meses vs. os 3 anteriores).`;
    case "margin_improving":
      return `Margem de contribuição subiu de ${s.fromPercent.toFixed(1)}% pra ${s.toPercent.toFixed(1)}% (média dos últimos 3 meses vs. os 3 anteriores).`;
    case "fixed_costs_outpacing_revenue": {
      const revenueDirection = s.revenueDelta >= 0 ? "cresceu" : "caiu";
      const categoriesText =
        s.topCategories.length > 0
          ? ` Os maiores responsáveis foram: ${s.topCategories
              .map((c) => `${c.name} (+${formatBRL(c.delta)})`)
              .join(", ")}.`
          : "";
      return `Custos fixos aumentaram ${formatBRL(s.fixedCostsDelta)} (${
        s.fixedCostsGrowthPercent >= 0 ? "+" : ""
      }${s.fixedCostsGrowthPercent.toFixed(0)}%) enquanto a receita ${revenueDirection} ${Math.abs(
        s.revenueGrowthPercent,
      ).toFixed(0)}%.${categoriesText}`;
    }
    case "cash_declining":
      return `Saldo em conta caindo há ${s.months} meses seguidos.`;
    case "cash_growing":
      return `Saldo em conta crescendo há ${s.months} meses seguidos.`;
  }
}

export const HEALTH_SEVERITY_STYLE: Record<HealthSignal["severity"], string> = {
  critical: "border-red-400/40 bg-red-400/10 text-red-400",
  warning: "border-amber-400/40 bg-amber-400/10 text-amber-400",
  info: "border-sky-400/40 bg-sky-400/10 text-sky-400",
};

export const HEALTH_SEVERITY_LABEL: Record<HealthSignal["severity"], string> = {
  critical: "Alerta",
  warning: "Atenção",
  info: "Análise",
};
