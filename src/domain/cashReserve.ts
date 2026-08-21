export type ReserveProvision = {
  yearTarget: number;
  monthlyAccrual: number;
  accruedSoFar: number;
  remainingThisYear: number;
};

/**
 * Provisão de 13º salário: 1 mês de folha por ano, acumulada em 1/12 por mês
 * (simplificação padrão — não considera admissão no meio do ano).
 */
export function computeThirteenthProvision(
  monthlySalaries: number,
  monthsElapsedInYear: number,
): ReserveProvision {
  const yearTarget = monthlySalaries;
  const monthlyAccrual = yearTarget / 12;
  const accruedSoFar = monthlyAccrual * monthsElapsedInYear;
  return { yearTarget, monthlyAccrual, accruedSoFar, remainingThisYear: yearTarget - accruedSoFar };
}

/**
 * Provisão de férias: 1 mês de folha + 1/3 constitucional por ano, acumulada
 * em 1/12 por mês (mesma simplificação do 13º).
 */
export function computeVacationProvision(
  monthlySalaries: number,
  monthsElapsedInYear: number,
): ReserveProvision {
  const yearTarget = monthlySalaries + monthlySalaries / 3;
  const monthlyAccrual = yearTarget / 12;
  const accruedSoFar = monthlyAccrual * monthsElapsedInYear;
  return { yearTarget, monthlyAccrual, accruedSoFar, remainingThisYear: yearTarget - accruedSoFar };
}

/** Meta de reserva de imprevistos: N meses do custo fixo mensal total. */
export function computeContingencyTarget(monthlyFixedCosts: number, monthsOfCoverage: number): number {
  return monthlyFixedCosts * monthsOfCoverage;
}

/**
 * Imposto estimado do mês: alíquota efetiva aplicada sobre o faturamento do
 * mês (base de cálculo do Simples Nacional é a receita bruta, não o lucro).
 * Diferente de 13º/férias, não acumula ano a ano — reseta todo mês.
 */
export function computeTaxEstimate(monthlyRevenue: number, ratePercent: number): number {
  return monthlyRevenue * (ratePercent / 100);
}

/**
 * Vencimento do DAS referente ao mês corrente: o imposto sobre a receita de
 * um mês é pago no dia `dueDay` do mês seguinte (regra padrão do Simples
 * Nacional). `year`/`month` são o mês de referência (1-indexado).
 */
export function computeTaxDueDate(year: number, month: number, dueDay: number): Date {
  // new Date(year, month, day) já é "mês seguinte" porque `month` (1-indexado
  // pro mês de referência) vira o índice 0-indexado do próximo mês; o
  // construtor do Date também normaliza sozinho a virada de ano em dezembro.
  return new Date(year, month, dueDay);
}

/** Dias corridos entre `from` e `dueDate` (pode ser negativo se já venceu). */
export function computeDaysUntil(dueDate: Date, from: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const fromMidnight = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const dueMidnight = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  return Math.round((dueMidnight.getTime() - fromMidnight.getTime()) / MS_PER_DAY);
}

/** Quantos dias restam no mês, contando hoje (dia 1 do mês = todos os dias do mês). */
export function computeDaysRemainingInMonth(year: number, month: number, today: number): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  return Math.max(1, daysInMonth - today + 1);
}

/** Quanto guardar por dia, no ritmo restante do mês, pra bater uma meta mensal. */
export function computeDailyGoal(monthlyTarget: number, daysRemainingInMonth: number): number {
  return monthlyTarget / daysRemainingInMonth;
}

export type ReserveAlert =
  | { type: "tax_due_soon_underfunded"; severity: "critical" | "warning"; daysUntilDue: number; target: number; saved: number }
  | { type: "contingency_low"; severity: "warning"; target: number; saved: number }
  | {
      type: "provision_behind_pace";
      severity: "warning";
      category: "thirteenth" | "vacation";
      accruedSoFar: number;
      saved: number;
    };

/**
 * Alertas de reserva de caixa a partir do relatório já calculado (imposto,
 * imprevistos, 13º/férias). Limiares escolhidos pra sinalizar antes que vire
 * emergência: imposto com <15 dias e ainda faltando guardar (crítico se
 * faltar 5 dias ou menos); imprevistos abaixo de 10% da meta (colchão quase
 * inexistente); 13º/férias guardando menos da metade do que já deveria ter
 * acumulado no ano até agora.
 */
export function computeReserveAlerts(input: {
  tax: { daysUntilDue: number; target: number; saved: number };
  contingency: { target: number; saved: number };
  thirteenth: { accruedSoFar: number; saved: number };
  vacation: { accruedSoFar: number; saved: number };
}): ReserveAlert[] {
  const alerts: ReserveAlert[] = [];

  if (input.tax.saved < input.tax.target && input.tax.daysUntilDue <= 15) {
    alerts.push({
      type: "tax_due_soon_underfunded",
      severity: input.tax.daysUntilDue <= 5 ? "critical" : "warning",
      daysUntilDue: input.tax.daysUntilDue,
      target: input.tax.target,
      saved: input.tax.saved,
    });
  }

  if (input.contingency.target > 0 && input.contingency.saved < input.contingency.target * 0.1) {
    alerts.push({
      type: "contingency_low",
      severity: "warning",
      target: input.contingency.target,
      saved: input.contingency.saved,
    });
  }

  for (const category of ["thirteenth", "vacation"] as const) {
    const provision = input[category];
    if (provision.accruedSoFar > 0 && provision.saved < provision.accruedSoFar * 0.5) {
      alerts.push({
        type: "provision_behind_pace",
        severity: "warning",
        category,
        accruedSoFar: provision.accruedSoFar,
        saved: provision.saved,
      });
    }
  }

  return alerts;
}
