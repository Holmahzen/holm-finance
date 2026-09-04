export type FixedCostFrequency = "MONTHLY" | "BIWEEKLY" | "WEEKLY";

export type FixedCostSchedule = {
  frequency: FixedCostFrequency;
  dueDay: number | null;
  secondDueDay: number | null;
  /** 0 = domingo .. 6 = sábado (mesma convenção do Date.getDay()). */
  weekday: number | null;
};

/**
 * Datas de vencimento de um custo fixo num mês específico, de acordo com a
 * frequência: mensal (1 dia), quinzenal (2 dias) ou semanal (toda ocorrência
 * do dia da semana no mês — 4 ou 5 vezes, dependendo do mês). Dias que
 * passam do fim do mês (ex.: dia 31 em fevereiro) são ajustados pro último
 * dia real do mês, igual já acontecia com o custo fixo mensal.
 */
export function computeFixedCostDueDates(
  schedule: FixedCostSchedule,
  year: number,
  month: number,
): Date[] {
  // Data em UTC-meia-noite (mesma convenção do resto do sistema, ex.:
  // src/domain/cashFlow.ts) — `new Date(year, month, day)` usa o fuso
  // horário local de onde o processo roda, que muda entre o PC local e o
  // Vercel (UTC), gerando datas diferentes pro "mesmo dia" e duplicando
  // lançamentos já existentes em vez de detectá-los como iguais.
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  switch (schedule.frequency) {
    case "MONTHLY": {
      if (schedule.dueDay === null) return [];
      const day = Math.min(schedule.dueDay, lastDayOfMonth);
      return [new Date(Date.UTC(year, month - 1, day))];
    }
    case "BIWEEKLY": {
      if (schedule.dueDay === null || schedule.secondDueDay === null) return [];
      const day1 = Math.min(schedule.dueDay, lastDayOfMonth);
      const day2 = Math.min(schedule.secondDueDay, lastDayOfMonth);
      return [new Date(Date.UTC(year, month - 1, day1)), new Date(Date.UTC(year, month - 1, day2))].sort(
        (a, b) => a.getTime() - b.getTime(),
      );
    }
    case "WEEKLY": {
      if (schedule.weekday === null) return [];
      const dates: Date[] = [];
      for (let day = 1; day <= lastDayOfMonth; day++) {
        const date = new Date(Date.UTC(year, month - 1, day));
        if (date.getUTCDay() === schedule.weekday) dates.push(date);
      }
      return dates;
    }
  }
}

/**
 * Valor total de um custo fixo NUM MÊS ESPECÍFICO, multiplicando o valor por
 * ocorrência pela quantidade de vencimentos no mês — essencial pra semanal
 * (4 ou 5 vezes/mês) e quinzenal (2x/mês), que custam bem mais por mês do que
 * o valor cadastrado por ocorrência sozinho.
 */
export function computeFixedCostMonthlyAmount(
  fc: { frequency: FixedCostFrequency; dueDay: number | null; secondDueDay: number | null; weekday: number | null; amount: number },
  year: number,
  month: number,
): number {
  const occurrences = computeFixedCostDueDates(
    { frequency: fc.frequency, dueDay: fc.dueDay, secondDueDay: fc.secondDueDay, weekday: fc.weekday },
    year,
    month,
  );
  return occurrences.length * fc.amount;
}
