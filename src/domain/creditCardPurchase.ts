import { DomainError } from "./errors";

export type Installment = {
  installmentNumber: number;
  amount: number;
  dueDate: Date;
};

/**
 * Divide o valor total em N parcelas iguais, ajustando os centavos de
 * arredondamento na última parcela. O vencimento repete o dia da 1ª parcela
 * nos meses seguintes, ajustado pro último dia real do mês quando necessário
 * (mesma regra usada no custo fixo mensal).
 */
export function computeInstallments(
  totalAmount: number,
  installments: number,
  firstDueDate: Date,
): Installment[] {
  if (installments < 1) {
    throw new DomainError("O número de parcelas deve ser pelo menos 1.");
  }

  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / installments);
  const remainderCents = totalCents - baseCents * installments;

  // Datas são tratadas como "dia do calendário" em UTC (mesma convenção usada
  // no resto do sistema: um <input type="date"> vira meia-noite UTC, e é
  // sempre exibido com timeZone: "UTC") — evita o vencimento cair um dia
  // antes/depois por causa do fuso do servidor.
  const year = firstDueDate.getUTCFullYear();
  const month = firstDueDate.getUTCMonth() + 1;
  const day = firstDueDate.getUTCDate();

  const result: Installment[] = [];
  for (let i = 0; i < installments; i++) {
    const targetMonthIndex = month - 1 + i;
    const targetYear = year + Math.floor(targetMonthIndex / 12);
    const targetMonth = (targetMonthIndex % 12) + 1;
    const lastDayOfMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
    const dueDate = new Date(Date.UTC(targetYear, targetMonth - 1, Math.min(day, lastDayOfMonth)));

    const amountCents = i === installments - 1 ? baseCents + remainderCents : baseCents;
    result.push({ installmentNumber: i + 1, amount: amountCents / 100, dueDate });
  }

  return result;
}
