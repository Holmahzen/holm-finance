import type { CashFlowMovement } from "@/domain/cashFlow";
import { payBeforeWeekend } from "@/domain/businessDays";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Um lançamento de DAS a até essa distância do vencimento já é o real daquele mês. */
const REAL_ENTRY_WINDOW_DAYS = 10;
/** Antes desse dia do mês, as notas do mês corrente ainda não dizem o ritmo dele. */
const MIN_DAYS_FOR_MONTH_PACE = 15;
/** Alíquota efetiva do Simples sobre o faturamento (último DAS oficial: 14,44% em setembro/2026). */
export const DAS_EFFECTIVE_RATE = 0.144;

const MONTH_NAMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function monthKey(year: number, monthIndex: number): string {
  const d = new Date(Date.UTC(year, monthIndex, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * DAS que ainda vai vencer dentro do período, como saída na data do pagamento.
 * O DAS do mês M vence no dia `dueDay` de M+1 e é calculado sobre o faturamento de M.
 *
 * O valor vem, em ordem: da apuração oficial do PGDAS-D do mês (quando já foi
 * importada), ou da estimativa = vendas das notas de saída do mês, descontadas
 * as devoluções emitidas no mês × alíquota efetiva. Para o mês corrente, as notas são projetadas pelo ritmo dos
 * dias já passados (ou pelo mês anterior, no começo do mês). Some quando já
 * existe o lançamento real do DAS daquele mês (pendente ou pago).
 */
export function estimateDasPayments(input: {
  today: Date;
  windowEnd: Date;
  dueDay: number;
  /** Lançamentos de DAS "Referente …" (parcelamento fora), pela data de vencimento. */
  dasEntryDates: Date[];
  /** Vendas das notas de saída por mês de emissão ("YYYY-MM"), já descontadas as devoluções; mês corrente = só até hoje. */
  salesByMonth: Record<string, number>;
  /**
   * Vendas brutas por mês, só para o começo do mês corrente (quando a base é o mês anterior): um mês
   * com devoluções acumuladas de meses passados não serve de referência líquida. Sem isso, usa `salesByMonth`.
   */
  grossSalesByMonth?: Record<string, number>;
  /** Apurações oficiais já importadas: total do DAS e vencimento, por mês de referência. */
  apuracoes: Record<string, { total: number; dueDate: Date | null }>;
  rate?: number;
}): CashFlowMovement[] {
  const { today, windowEnd, dueDay, dasEntryDates, salesByMonth, apuracoes } = input;
  const rate = input.rate ?? DAS_EFFECTIVE_RATE;
  const movements: CashFlowMovement[] = [];

  const curYear = today.getUTCFullYear();
  const curMonth = today.getUTCMonth();
  const daysElapsed = today.getUTCDate();
  const daysInCurMonth = new Date(Date.UTC(curYear, curMonth + 1, 0)).getUTCDate();

  for (let offset = 0; offset < 14; offset++) {
    // vencimento no mês (curMonth + offset); referência = mês anterior a ele
    const due = new Date(Date.UTC(curYear, curMonth + offset, dueDay));
    const refKey = monthKey(curYear, curMonth + offset - 1);
    const official = apuracoes[refKey];
    const dueDate = official?.dueDate ?? due;
    const payDate = payBeforeWeekend(dueDate);
    if (payDate >= windowEnd) break;
    if (payDate < today) continue;

    const hasRealEntry = dasEntryDates.some(
      (d) => Math.abs(d.getTime() - dueDate.getTime()) <= REAL_ENTRY_WINDOW_DAYS * MS_PER_DAY,
    );
    if (hasRealEntry) continue;

    const refName = MONTH_NAMES[(curMonth + offset - 1 + 1200) % 12];

    if (official) {
      if (official.total <= 0) continue;
      movements.push({
        date: payDate,
        amount: -official.total,
        label: `DAS referente ${refName} (valor oficial do PGDAS-D)`,
        categoryName: "DAS",
      });
      continue;
    }

    const isCurrentMonth = refKey === monthKey(curYear, curMonth);
    const sales = salesByMonth[refKey] ?? 0;
    // Poucos dias de mês (ou notas do mês ainda não importadas) não dão ritmo: cai no mês anterior.
    const prevSales = (input.grossSalesByMonth ?? salesByMonth)[monthKey(curYear, curMonth - 1)] ?? 0;
    const earlyInMonth = isCurrentMonth && (daysElapsed < MIN_DAYS_FOR_MONTH_PACE || sales <= 0) && prevSales > 0;
    if (!earlyInMonth && sales <= 0) continue;
    const revenue = earlyInMonth ? prevSales : isCurrentMonth ? (sales / daysElapsed) * daysInCurMonth : sales;
    const amount = revenue * rate;
    if (amount <= 0) continue;

    const basis = earlyInMonth
      ? "das vendas brutas do mês anterior (mês ainda no começo)"
      : isCurrentMonth
        ? "das notas projetadas do mês"
        : "das notas do mês, já sem as devoluções";
    movements.push({
      date: payDate,
      amount: -amount,
      label: `DAS (estimado) referente ${refName}: ${(rate * 100).toFixed(1).replace(".", ",")}% ${basis}`,
      categoryName: "DAS",
    });
  }

  return movements;
}
