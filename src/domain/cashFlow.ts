const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type CashFlowMovement = {
  /** Data em UTC-meia-noite (mesmo formato usado pelos campos de data do Prisma). */
  date: Date;
  /** Positivo = entrada, negativo = saída. */
  amount: number;
  label: string;
};

export type CashFlowDay = {
  date: Date;
  inflow: number;
  outflow: number;
  netChange: number;
  runningBalance: number;
  movements: CashFlowMovement[];
};

function utcDayTimestamp(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Projeta o saldo dia a dia a partir de hoje, somando/subtraindo os
 * movimentos (contas a pagar/receber pendentes) na data em que devem
 * acontecer. `startDate` deve ser meia-noite UTC do dia de referência
 * ("hoje"), no mesmo formato que os campos de data do Prisma — assim a
 * comparação com `movement.date` não depende do fuso horário do processo.
 */
export function computeCashFlowProjection(
  startingBalance: number,
  movements: CashFlowMovement[],
  startDate: Date,
  days: number,
): CashFlowDay[] {
  const byDay = new Map<number, CashFlowMovement[]>();
  for (const m of movements) {
    const key = utcDayTimestamp(m.date);
    const list = byDay.get(key) ?? [];
    list.push(m);
    byDay.set(key, list);
  }

  const startKey = utcDayTimestamp(startDate);
  const result: CashFlowDay[] = [];
  let running = startingBalance;

  for (let i = 0; i < days; i++) {
    const dayKey = startKey + i * MS_PER_DAY;
    const dayMovements = byDay.get(dayKey) ?? [];
    const inflow = dayMovements.filter((m) => m.amount > 0).reduce((s, m) => s + m.amount, 0);
    const outflow = dayMovements
      .filter((m) => m.amount < 0)
      .reduce((s, m) => s + Math.abs(m.amount), 0);
    const netChange = inflow - outflow;
    running += netChange;

    result.push({
      date: new Date(dayKey),
      inflow,
      outflow,
      netChange,
      runningBalance: running,
      movements: dayMovements,
    });
  }

  return result;
}

/** Primeiro dia em que o saldo projetado fica negativo, se houver. */
export function findFirstNegativeDay(projection: CashFlowDay[]): CashFlowDay | null {
  return projection.find((d) => d.runningBalance < 0) ?? null;
}

export type WeeklyCashFlowBucket = {
  startDate: Date;
  endDate: Date;
  inflow: number;
  outflow: number;
  netChange: number;
  /** Saldo projetado no último dia do bloco (o mesmo `runningBalance` já calculado, não um novo cálculo). */
  endingBalance: number;
  days: number;
};

/**
 * Agrupa a projeção dia a dia em blocos corridos de `weekLengthDays` dias a
 * partir de hoje (não semana de calendário) — o último bloco pode ficar
 * menor que os outros se o total de dias não for múltiplo exato.
 */
export function aggregateProjectionByWeek(
  projectionDays: CashFlowDay[],
  weekLengthDays = 7,
): WeeklyCashFlowBucket[] {
  const buckets: WeeklyCashFlowBucket[] = [];

  for (let i = 0; i < projectionDays.length; i += weekLengthDays) {
    const chunk = projectionDays.slice(i, i + weekLengthDays);
    if (chunk.length === 0) continue;

    const inflow = chunk.reduce((sum, d) => sum + d.inflow, 0);
    const outflow = chunk.reduce((sum, d) => sum + d.outflow, 0);

    buckets.push({
      startDate: chunk[0].date,
      endDate: chunk[chunk.length - 1].date,
      inflow,
      outflow,
      netChange: inflow - outflow,
      endingBalance: chunk[chunk.length - 1].runningBalance,
      days: chunk.length,
    });
  }

  return buckets;
}
