export type PendingInstallment = {
  amount: number;
  dueDate: Date;
};

export type MonthlyCommitment = {
  year: number;
  month: number;
  committed: number;
};

/**
 * Soma as parcelas pendentes por mês de vencimento, a partir de um mês
 * inicial, cobrindo `monthsAhead` meses seguidos (mesmo os sem nenhuma
 * parcela, que entram com committed = 0). `dueDate` é tratado como "dia do
 * calendário" em UTC — mesma convenção usada no resto do sistema.
 */
export function computeMonthlyCommitment(
  installments: PendingInstallment[],
  startYear: number,
  startMonth: number,
  monthsAhead: number,
): MonthlyCommitment[] {
  const months: MonthlyCommitment[] = [];
  for (let i = 0; i < monthsAhead; i++) {
    const idx = startMonth - 1 + i;
    const year = startYear + Math.floor(idx / 12);
    const month = (idx % 12) + 1;
    months.push({ year, month, committed: 0 });
  }

  for (const installment of installments) {
    const y = installment.dueDate.getUTCFullYear();
    const m = installment.dueDate.getUTCMonth() + 1;
    const bucket = months.find((b) => b.year === y && b.month === m);
    if (bucket) bucket.committed += installment.amount;
  }

  return months;
}
