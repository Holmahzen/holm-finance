/**
 * Pagamentos não saem no fim de semana: quando o vencimento cai no sábado ou
 * domingo, a Holm adianta para a sexta anterior (nunca empurra para segunda).
 * Datas em UTC, como o resto do sistema. Só vale para o que a Holm PAGA — o que
 * ela recebe segue a data do pagador. Feriados não entram: só sábado e domingo.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

export function payBeforeWeekend(date: Date): Date {
  const weekday = date.getUTCDay(); // 0 domingo, 6 sábado
  if (weekday === 6) return new Date(date.getTime() - DAY_MS);
  if (weekday === 0) return new Date(date.getTime() - 2 * DAY_MS);
  return date;
}

/** `undefined` quando o vencimento já é dia útil — aí não há data de pagamento a gravar. */
export function weekendPaymentDate(dueDate: Date): Date | undefined {
  const adjusted = payBeforeWeekend(dueDate);
  return adjusted.getTime() === dueDate.getTime() ? undefined : adjusted;
}
