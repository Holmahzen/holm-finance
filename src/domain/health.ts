export type CategoryTotal = { categoryId: string; name: string; total: number };

export type HealthMonth = {
  year: number;
  month: number;
  receitaLiquida: number;
  despesasFixas: number;
  despesasFixasByCategory: CategoryTotal[];
  margemContribuicaoPercent: number | null;
  lucroLiquido: number;
  saldoConta: number | null;
};

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

const SEVERITY_RANK: Record<HealthSignal["severity"], number> = { critical: 0, warning: 1, info: 2 };

/** Meses com alguma atividade real (ignora meses futuros/vazios sem lançamento). */
function activeMonths(series: HealthMonth[]): HealthMonth[] {
  return series.filter((m) => m.receitaLiquida !== 0 || m.despesasFixas !== 0 || m.lucroLiquido !== 0);
}

function trailingStreak(values: number[], direction: "down" | "up"): number {
  let streak = values.length > 0 ? 1 : 0;
  for (let i = values.length - 1; i > 0; i--) {
    const decreasing = values[i] < values[i - 1];
    const increasing = values[i] > values[i - 1];
    if ((direction === "down" && decreasing) || (direction === "up" && increasing)) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function percentChange(from: number, to: number): number {
  if (from === 0) return to === 0 ? 0 : 100;
  return ((to - from) / Math.abs(from)) * 100;
}

/**
 * As categorias de despesa fixa que mais aumentaram entre dois meses (ex.:
 * folha, aluguel), pra transformar "custos fixos subiram X%" num alerta
 * acionável em vez de genérico. Ignora categorias que caíram ou ficaram
 * estáveis — essas não são "responsáveis" pelo aumento.
 */
function topGrowingCategories(
  from: CategoryTotal[],
  to: CategoryTotal[],
  limit = 3,
): { name: string; delta: number }[] {
  const fromByName = new Map(from.map((c) => [c.name, c.total]));
  const toByName = new Map(to.map((c) => [c.name, c.total]));
  const names = new Set([...fromByName.keys(), ...toByName.keys()]);

  return Array.from(names)
    .map((name) => ({ name, delta: (toByName.get(name) ?? 0) - (fromByName.get(name) ?? 0) }))
    .filter((c) => c.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, limit);
}

/**
 * Lê a série mensal (ordenada do mais antigo pro mais recente) e devolve
 * sinais de diagnóstico: sequências de queda/crescimento de receita, lucro,
 * margem e saldo, e custo fixo crescendo mais rápido que a receita.
 * Ignora meses sem nenhuma atividade (ainda não chegaram ou não têm
 * lançamento), pra não confundir "mês futuro vazio" com "queda".
 */
export function computeHealthSignals(series: HealthMonth[]): HealthSignal[] {
  const signals: HealthSignal[] = [];
  const active = activeMonths(series);

  if (active.length >= 2) {
    const revenues = active.map((m) => m.receitaLiquida);
    const downStreak = trailingStreak(revenues, "down");
    const upStreak = trailingStreak(revenues, "up");
    if (downStreak >= 2) {
      signals.push({ type: "revenue_declining", severity: "warning", months: downStreak });
    } else if (upStreak >= 2) {
      signals.push({ type: "revenue_growing", severity: "info", months: upStreak });
    }
  }

  if (active.length >= 1) {
    const profits = active.map((m) => m.lucroLiquido);
    let lossStreak = 0;
    for (let i = profits.length - 1; i >= 0 && profits[i] < 0; i--) lossStreak++;
    if (lossStreak >= 2) {
      signals.push({ type: "loss_streak", severity: "critical", months: lossStreak });
    } else if (lossStreak === 1) {
      signals.push({ type: "loss_streak", severity: "warning", months: lossStreak });
    } else {
      let profitStreak = 0;
      for (let i = profits.length - 1; i >= 0 && profits[i] > 0; i--) profitStreak++;
      if (profitStreak >= 3) {
        signals.push({ type: "profit_streak", severity: "info", months: profitStreak });
      }
    }
  }

  const withMargin = active.filter((m) => m.margemContribuicaoPercent !== null);
  if (withMargin.length >= 4) {
    const recent = withMargin.slice(-3);
    const previous = withMargin.slice(-6, -3);
    if (previous.length >= 2) {
      const avg = (arr: HealthMonth[]) =>
        arr.reduce((s, m) => s + (m.margemContribuicaoPercent ?? 0), 0) / arr.length;
      const fromPercent = avg(previous);
      const toPercent = avg(recent);
      if (fromPercent - toPercent > 5) {
        signals.push({ type: "margin_declining", severity: "warning", fromPercent, toPercent });
      } else if (toPercent - fromPercent > 5) {
        signals.push({ type: "margin_improving", severity: "info", fromPercent, toPercent });
      }
    }
  }

  if (active.length >= 2) {
    const first = active[0];
    const last = active[active.length - 1];
    const fixedCostsGrowthPercent = percentChange(first.despesasFixas, last.despesasFixas);
    const revenueGrowthPercent = percentChange(first.receitaLiquida, last.receitaLiquida);
    if (fixedCostsGrowthPercent > revenueGrowthPercent && fixedCostsGrowthPercent > 0) {
      signals.push({
        type: "fixed_costs_outpacing_revenue",
        severity: "warning",
        fixedCostsGrowthPercent,
        revenueGrowthPercent,
        fixedCostsDelta: last.despesasFixas - first.despesasFixas,
        revenueDelta: last.receitaLiquida - first.receitaLiquida,
        topCategories: topGrowingCategories(
          first.despesasFixasByCategory,
          last.despesasFixasByCategory,
        ),
      });
    }
  }

  const withCash = series.filter((m) => m.saldoConta !== null);
  if (withCash.length >= 2) {
    const balances = withCash.map((m) => m.saldoConta as number);
    const downStreak = trailingStreak(balances, "down");
    const upStreak = trailingStreak(balances, "up");
    if (downStreak >= 2) {
      signals.push({ type: "cash_declining", severity: "warning", months: downStreak });
    } else if (upStreak >= 2) {
      signals.push({ type: "cash_growing", severity: "info", months: upStreak });
    }
  }

  return signals.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}
