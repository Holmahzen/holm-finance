/**
 * Checklist de fechamento do mês: o que já foi importado e conferido, e o
 * que falta — num lugar só, em vez de avisos soltos dentro da DRE.
 *
 * Funções puras: o serviço busca as datas e contagens e aqui vira status.
 */

export type ChecklistStatus = "ok" | "parcial" | "pendente" | "aguardando";

export type ChecklistItem = {
  key: string;
  group: "Importações" | "Conferências" | "Avisos da DRE";
  title: string;
  status: ChecklistStatus;
  detail: string;
  href: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export type MonthWindow = {
  /** "YYYY-MM". */
  month: string;
  start: Date;
  /** Primeiro dia do mês seguinte. */
  end: Date;
  /** Último dia que já deveria ter dado: o fim do mês, ou ontem se o mês está em andamento. */
  lastExpectedDay: Date;
  inProgress: boolean;
};

export function monthWindow(month: string, today: Date): MonthWindow {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  const lastDay = new Date(end.getTime() - DAY_MS);
  const yesterday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - DAY_MS);
  const inProgress = today.getTime() < end.getTime();
  return { month, start, end, lastExpectedDay: inProgress ? yesterday : lastDay, inProgress };
}

export function formatDay(date: Date): string {
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function dayOf(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Até que dia um relatório cobre o mês: ok se chega no último dia esperado,
 * parcial se cobre só uma parte, pendente se não tem nada do mês.
 * `toleranceDays` aceita relatório que fecha um dia antes (vendas da noite).
 */
export function coverageStatus(
  latest: Date | null,
  w: MonthWindow,
  toleranceDays = 1,
): { status: ChecklistStatus; detail: string } {
  if (w.lastExpectedDay.getTime() < w.start.getTime()) {
    return { status: "aguardando", detail: "O mês acabou de começar." };
  }
  if (!latest || latest.getTime() < w.start.getTime()) return { status: "pendente", detail: "Nada importado deste mês." };
  if (dayOf(latest) >= dayOf(w.lastExpectedDay) - toleranceDays * DAY_MS) {
    return { status: "ok", detail: `Importado até ${formatDay(latest.getTime() >= w.end.getTime() ? w.lastExpectedDay : latest)}.` };
  }
  return { status: "parcial", detail: `Importado só até ${formatDay(latest)} — falta até ${formatDay(w.lastExpectedDay)}.` };
}

/** Dias do mês cobertos por pelo menos um período (relatório de Ads é por período escolhido na exportação). */
export function coveredDays(periods: { start: Date; end: Date }[], w: MonthWindow): number {
  const covered = new Set<number>();
  for (const p of periods) {
    const from = Math.max(dayOf(p.start), w.start.getTime());
    const to = Math.min(dayOf(p.end), dayOf(w.lastExpectedDay));
    for (let d = from; d <= to; d += DAY_MS) covered.add(d);
  }
  return covered.size;
}

export function daysExpected(w: MonthWindow): number {
  return Math.max(0, Math.round((dayOf(w.lastExpectedDay) - w.start.getTime()) / DAY_MS) + 1);
}

/** Documento que só sai depois do mês (PGDAS-D até dia 20, notas de serviço do ML no começo do mês seguinte). */
export function availableFrom(w: MonthWindow, day: number): Date {
  return new Date(Date.UTC(w.end.getUTCFullYear(), w.end.getUTCMonth(), day));
}

export function countStatus(count: number, okWhenZero: boolean): ChecklistStatus {
  return (count === 0) === okWhenZero ? "ok" : "pendente";
}

export function summarize(items: ChecklistItem[]) {
  const done = items.filter((i) => i.status === "ok").length;
  const relevant = items.filter((i) => i.status !== "aguardando").length;
  return { done, total: relevant, pending: items.filter((i) => i.status === "pendente" || i.status === "parcial").length };
}
