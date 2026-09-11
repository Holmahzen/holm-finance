export const SIMPLES_NACIONAL_CEILING = 4_800_000;
/** Sublimite que muda a forma de recolher ICMS/ISS (não tira do Simples) — informativo. */
export const SIMPLES_NACIONAL_SUBLIMIT = 3_600_000;

const ALERT_THRESHOLD_ATENCAO_PERCENT = 80;
const ALERT_THRESHOLD_CRITICO_PERCENT = 95;

export type MonthlyRevenue = { year: number; month: number; revenue: number };

export type AlertLevel = "ok" | "atencao" | "critico";

export type SimplesNacionalStatus = {
  rbt12: number;
  rbt12PercentOfCeiling: number;
  rbt12RemainingToCeiling: number;
  yearToDate: number;
  yearToDatePercentOfCeiling: number;
  /** Null quando não há nenhum mês fechado ainda pra estimar o ritmo (ex.: janeiro). */
  projectedYearEnd: number | null;
  projectedYearEndPercentOfCeiling: number | null;
  alertLevel: AlertLevel;
};

function alertLevelFromPercent(percent: number): AlertLevel {
  if (percent >= ALERT_THRESHOLD_CRITICO_PERCENT) return "critico";
  if (percent >= ALERT_THRESHOLD_ATENCAO_PERCENT) return "atencao";
  return "ok";
}

/**
 * Últimos `count` meses terminando em (year, month), inclusive — ex.: (2026, 9, 12)
 * devolve de outubro/2025 a setembro/2026.
 */
export function computeTrailingMonths(
  year: number,
  month: number,
  count: number,
): { year: number; month: number }[] {
  const result: { year: number; month: number }[] = [];
  let y = year;
  let m = month;
  for (let i = 0; i < count; i++) {
    result.unshift({ year: y, month: m });
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return result;
}

/**
 * `monthlyRevenues` deve trazer os últimos 12 meses (inclusive o mês corrente,
 * mesmo que parcial) — normalmente o resultado de `computeTrailingMonths(..., 12)`
 * com a receita bruta de cada um.
 */
export function computeSimplesNacionalStatus(
  monthlyRevenues: MonthlyRevenue[],
  currentYear: number,
  currentMonth: number,
  ceiling = SIMPLES_NACIONAL_CEILING,
): SimplesNacionalStatus {
  const rbt12 = monthlyRevenues.reduce((sum, m) => sum + m.revenue, 0);
  const yearToDate = monthlyRevenues
    .filter((m) => m.year === currentYear)
    .reduce((sum, m) => sum + m.revenue, 0);

  // Projeção de fechamento do ano: ritmo médio dos últimos 3 meses FECHADOS
  // (sem contar o mês corrente, ainda em andamento) extrapolado pros meses
  // que faltam até dezembro, somado ao que já foi faturado no ano.
  const closedMonths = monthlyRevenues.filter(
    (m) => !(m.year === currentYear && m.month === currentMonth),
  );
  const last3Closed = closedMonths.slice(-3);
  const monthsRemaining = 12 - currentMonth;
  let projectedYearEnd: number | null = null;
  if (last3Closed.length > 0) {
    const avgMonthly = last3Closed.reduce((sum, m) => sum + m.revenue, 0) / last3Closed.length;
    projectedYearEnd = yearToDate + avgMonthly * monthsRemaining;
  }

  const rbt12PercentOfCeiling = ceiling > 0 ? (rbt12 / ceiling) * 100 : 0;

  return {
    rbt12,
    rbt12PercentOfCeiling,
    rbt12RemainingToCeiling: ceiling - rbt12,
    yearToDate,
    yearToDatePercentOfCeiling: ceiling > 0 ? (yearToDate / ceiling) * 100 : 0,
    projectedYearEnd,
    projectedYearEndPercentOfCeiling:
      projectedYearEnd !== null && ceiling > 0 ? (projectedYearEnd / ceiling) * 100 : null,
    alertLevel: alertLevelFromPercent(rbt12PercentOfCeiling),
  };
}
