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

/** Antes disso, o ritmo do mês corrente é amostra pequena demais pra projetar sozinho. */
export const MIN_DAYS_FOR_MONTH_PACE = 7;

/**
 * Igual a `computeMonthRevenueProjection`, mas nos primeiros dias do mês
 * (menos de `MIN_DAYS_FOR_MONTH_PACE`) usa um ritmo de referência — ex.: o
 * dos últimos 30 dias — pros dias que faltam, somado ao que já foi faturado.
 * Sem isso, no dia 2 o mês é projetado a partir de 1–2 dias de venda.
 */
export function computeMonthRevenueProjectionWithFallback(
  actualRevenue: number,
  daysElapsed: number,
  daysInMonth: number,
  fallbackDailyPace: number | null,
): RevenueProjection | null {
  if (daysElapsed >= MIN_DAYS_FOR_MONTH_PACE || fallbackDailyPace === null || fallbackDailyPace <= 0) {
    return computeMonthRevenueProjection(actualRevenue, daysElapsed, daysInMonth);
  }
  if (daysInMonth <= 0) return null;
  const remainingDays = Math.max(0, daysInMonth - daysElapsed);
  return {
    daysElapsed,
    daysInMonth,
    dailyPace: fallbackDailyPace,
    projectedRevenue: actualRevenue + fallbackDailyPace * remainingDays,
  };
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
