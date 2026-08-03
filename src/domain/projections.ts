export type RevenueProjection = {
  daysElapsed: number;
  daysInMonth: number;
  dailyPace: number;
  projectedRevenue: number;
};

/**
 * Projeta o faturamento do mês corrente com base no ritmo diário de vendas
 * até agora (faturamento acumulado / dias decorridos × dias no mês).
 * `null` quando ainda não passou nenhum dia (nada pra projetar a partir de).
 */
export function computeMonthRevenueProjection(
  actualRevenue: number,
  daysElapsed: number,
  daysInMonth: number,
): RevenueProjection | null {
  if (daysElapsed <= 0 || daysInMonth <= 0) return null;
  const dailyPace = actualRevenue / daysElapsed;
  const projectedRevenue = dailyPace * daysInMonth;
  return { daysElapsed, daysInMonth, dailyPace, projectedRevenue };
}

/**
 * Em que dia do mês o ponto de equilíbrio deve ser atingido, no ritmo diário
 * atual. `null` quando não há ritmo positivo ou quando o ritmo atual não
 * atinge a meta dentro do próprio mês.
 */
export function computeProjectedBreakEvenDay(
  breakEvenRevenue: number | null,
  dailyPace: number,
  daysInMonth: number,
): number | null {
  if (breakEvenRevenue === null || breakEvenRevenue <= 0 || dailyPace <= 0) return null;
  const day = Math.ceil(breakEvenRevenue / dailyPace);
  return day <= daysInMonth ? day : null;
}
