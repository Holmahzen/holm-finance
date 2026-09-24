import type { CashFlowMovement } from "@/domain/cashFlow";
import { addDaysUTC } from "@/domain/plannedPurchase";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Dias entre fechar a quinzena e pagar a fatura da transportadora (histórico: 2 a 6, média ~4). */
export const FLEX_PAY_DELAY_DAYS = 4;
/** Um lançamento de Flex nessa janela depois do fechamento já é a fatura real daquela quinzena. */
const REAL_INVOICE_WINDOW_DAYS = 12;
/** Só conta como fatura real um lançamento de pelo menos essa fração da estimativa (ignora avulsos pequenos). */
const REAL_INVOICE_MIN_FRACTION = 0.4;
/** Poucos dias de dado na quinzena dão um ritmo instável: cai no ritmo dos últimos 30 dias. */
const MIN_DAYS_FOR_OWN_PACE = 3;

export type Fortnight = { start: Date; end: Date; days: number };

function utcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Quinzena de calendário (1–15 ou 16–fim do mês) que contém a data. `end` é o último dia, inclusive. */
export function fortnightOf(date: Date): Fortnight {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  if (date.getUTCDate() <= 15) {
    return { start: new Date(Date.UTC(y, m, 1)), end: new Date(Date.UTC(y, m, 15)), days: 15 };
  }
  const end = new Date(Date.UTC(y, m + 1, 0));
  return { start: new Date(Date.UTC(y, m, 16)), end, days: end.getUTCDate() - 15 };
}

function nextFortnight(f: Fortnight): Fortnight {
  return fortnightOf(addDaysUTC(f.end, 1));
}

export type FlexSaleDay = { date: Date; flexCount: number };
export type FlexEntryRef = { date: Date; amount: number };

function fmt(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Fatura Flex estimada por quinzena (pedidos Flex × tarifa por pacote), como
 * saída na data em que costuma ser paga. Usa as vendas já importadas; o que
 * falta pra fechar a quinzena é projetado pelo ritmo dela (ou pelo dos
 * últimos 30 dias quando há poucos dias de dado). Some quando já existe o
 * lançamento real da fatura.
 */
export function estimateFlexInvoices(input: {
  today: Date;
  windowEnd: Date;
  /** Pedidos Flex válidos por dia (cancelados fora). */
  flexByDay: FlexSaleDay[];
  /** Último dia com venda importada (de qualquer modalidade) — o que vem depois é "ainda não importado". */
  lastSaleDate: Date | null;
  /** Ritmo médio de pedidos Flex por dia nos últimos 30 dias. */
  paceFlexPerDay: number;
  feePerPackage: number;
  /** Lançamentos da categoria Flex (pendentes ou pagos), pela data de vencimento. */
  flexEntries: FlexEntryRef[];
}): CashFlowMovement[] {
  const { flexByDay, feePerPackage, paceFlexPerDay, flexEntries } = input;
  const today = utcMidnight(input.today);
  const lastSale = input.lastSaleDate ? utcMidnight(input.lastSaleDate) : null;
  const movements: CashFlowMovement[] = [];

  // começa na quinzena que fechou há pouco (fatura ainda pode estar por pagar)
  let q = fortnightOf(addDaysUTC(today, -(FLEX_PAY_DELAY_DAYS + 6)));

  for (let guard = 0; guard < 12; guard++, q = nextFortnight(q)) {
    const due = addDaysUTC(q.end, FLEX_PAY_DELAY_DAYS);
    if (due >= input.windowEnd) break;

    const dataEnd = lastSale && lastSale >= q.start ? (lastSale < q.end ? lastSale : q.end) : null;
    const daysWithData = dataEnd ? Math.round((dataEnd.getTime() - q.start.getTime()) / MS_PER_DAY) + 1 : 0;
    const counted = flexByDay
      .filter((d) => d.date >= q.start && d.date <= q.end)
      .reduce((s, d) => s + d.flexCount, 0);

    const remainingDays = q.days - daysWithData;
    const rate = daysWithData >= MIN_DAYS_FOR_OWN_PACE ? counted / daysWithData : paceFlexPerDay;
    const projected = Math.round(counted + remainingDays * rate);
    const amount = projected * feePerPackage;
    if (amount <= 0) continue;

    const realInvoice = flexEntries.some(
      (e) =>
        e.date > q.end &&
        e.date <= addDaysUTC(q.end, REAL_INVOICE_WINDOW_DAYS) &&
        e.amount >= amount * REAL_INVOICE_MIN_FRACTION,
    );
    if (realInvoice) continue;

    const tail =
      remainingDays > 0 && daysWithData > 0
        ? `, vendas até ${fmt(dataEnd!)}`
        : daysWithData === 0
          ? ", pelo ritmo dos últimos 30 dias"
          : "";
    movements.push({
      date: due < today ? today : due,
      amount: -amount,
      label: `Flex (estimado) ${fmt(q.start)}–${fmt(q.end)}: ≈ ${projected} pedidos × R$ ${feePerPackage.toFixed(2).replace(".", ",")}${tail}`,
    });
  }

  return movements;
}
