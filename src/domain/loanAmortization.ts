export type AmortizationInstallment = {
  number: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
};

/**
 * Tabela Price (parcelas fixas): cada parcela = juros sobre o saldo devedor
 * + amortização do principal. É o sistema padrão de empréstimo parcelado
 * fixo no Brasil (Sicredi incluso). Só o `interest` de cada parcela é
 * despesa financeira de verdade — o `principal` é devolução de dívida, não
 * entra na DRE.
 */
export function computePriceAmortization(
  principal: number,
  monthlyRatePercent: number,
  installments: number,
): AmortizationInstallment[] {
  const i = monthlyRatePercent / 100;
  const payment =
    i === 0
      ? principal / installments
      : (principal * i) / (1 - Math.pow(1 + i, -installments));

  const schedule: AmortizationInstallment[] = [];
  let balance = principal;

  for (let n = 1; n <= installments; n++) {
    const interest = balance * i;
    const principalPortion = payment - interest;
    balance -= principalPortion;
    schedule.push({
      number: n,
      payment,
      interest,
      principal: principalPortion,
      balance: Math.max(balance, 0),
    });
  }

  return schedule;
}

/**
 * Dado o valor real de uma parcela paga e o saldo devedor até ali, separa
 * juros de principal sem precisar da tabela inteira — útil quando você só
 * quer conferir uma parcela específica.
 */
export function splitInstallment(
  outstandingBalance: number,
  monthlyRatePercent: number,
  paymentAmount: number,
) {
  const interest = outstandingBalance * (monthlyRatePercent / 100);
  const principal = paymentAmount - interest;
  return { interest, principal, newBalance: outstandingBalance - principal };
}

export type LoanConfig = {
  principal: number;
  monthlyRatePercent: number;
  installments: number;
};

/**
 * Saldo devedor atual do empréstimo, dado quantas parcelas já foram pagas —
 * pra Passivo do balanço patrimonial (quanto ainda falta pagar, não o
 * principal original). Nenhuma parcela paga ainda = saldo cheio.
 */
export function computeOutstandingPrincipal(loan: LoanConfig, paidInstallments: number): number {
  if (paidInstallments <= 0) return loan.principal;
  const schedule = computePriceAmortization(loan.principal, loan.monthlyRatePercent, loan.installments);
  const lastPaid = schedule[Math.min(paidInstallments, schedule.length) - 1];
  return lastPaid ? lastPaid.balance : 0;
}

export type LoanPayment = { id: string; paidAmount: number; paidAt: Date };

export type LoanPeriodSplit = {
  cashPaidInPeriod: number;
  interestInPeriod: number;
  principalInPeriod: number;
  matchedCount: number;
};

/**
 * Quanto do que foi pago desse empréstimo DENTRO do período é juros de
 * verdade, dado o histórico completo de parcelas já pagas (todas, desde a
 * primeira, ordenadas por data — precisa da lista inteira porque a
 * numeração da parcela na tabela Price depende de quantas já foram pagas
 * antes, não só das que caem no período).
 */
export function computeLoanInterestForPeriod(
  loan: LoanConfig,
  allPaymentsSortedByDate: LoanPayment[],
  periodStart: Date,
  periodEnd: Date,
): LoanPeriodSplit {
  const schedule = computePriceAmortization(loan.principal, loan.monthlyRatePercent, loan.installments);

  let cashPaidInPeriod = 0;
  let interestInPeriod = 0;
  let principalInPeriod = 0;
  let matchedCount = 0;

  allPaymentsSortedByDate.forEach((payment, idx) => {
    if (payment.paidAt < periodStart || payment.paidAt >= periodEnd) return;
    const installment = schedule[idx];
    cashPaidInPeriod += payment.paidAmount;
    if (installment) {
      interestInPeriod += installment.interest;
      principalInPeriod += installment.principal;
    } else {
      // Além do número de parcelas previsto: sem tabela pra guiar, mantém
      // o valor cheio como juros em vez de assumir que é principal.
      interestInPeriod += payment.paidAmount;
    }
    matchedCount++;
  });

  return { cashPaidInPeriod, interestInPeriod, principalInPeriod, matchedCount };
}
