"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ChecklistStatus = "ok" | "parcial" | "pendente" | "aguardando";

type ChecklistItem = {
  key: string;
  group: "Importações" | "Conferências" | "Avisos da DRE";
  title: string;
  status: ChecklistStatus;
  detail: string;
  href: string;
};

type Checklist = {
  month: string;
  inProgress: boolean;
  items: ChecklistItem[];
  summary: { done: number; total: number; pending: number };
};

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const STATUS_STYLE: Record<ChecklistStatus, { icon: string; label: string; className: string }> = {
  ok: { icon: "✅", label: "Pronto", className: "text-emerald-400" },
  parcial: { icon: "🟡", label: "Incompleto", className: "text-amber-300" },
  pendente: { icon: "❌", label: "Falta", className: "text-red-400" },
  aguardando: { icon: "⏳", label: "Ainda não saiu", className: "text-muted" },
};

const GROUP_HELP: Record<ChecklistItem["group"], string> = {
  Importações: "Arquivos que o sistema precisa receber pra fechar o mês.",
  Conferências: "O que já está no sistema, mas precisa de um ajuste seu.",
  "Avisos da DRE": "O que a DRE por competência ainda acha estranho neste mês.",
};

const GROUP_ORDER: ChecklistItem["group"][] = ["Importações", "Conferências", "Avisos da DRE"];

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1]}/${y}`;
}

function lastMonths(count: number): string[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

export default function FechamentoDoMesPage() {
  const [month, setMonth] = useState<string | null>(null);
  const [data, setData] = useState<Checklist | null>(null);
  const [loadedMonth, setLoadedMonth] = useState<string | null>(null);

  useEffect(() => {
    const query = month ? `?month=${month}` : "";
    fetch(`/api/month-checklist${query}`)
      .then((res) => res.json())
      .then((json: Checklist) => {
        setData(json);
        setLoadedMonth(json.month);
      });
  }, [month]);

  const loading = !data || (month !== null && loadedMonth !== month);
  const percent = data && data.summary.total > 0 ? (data.summary.done / data.summary.total) * 100 : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-foreground">Fechamento do mês</h1>
          <p className="max-w-prose text-sm text-muted">
            Tudo o que precisa estar no sistema pra os números do mês valerem — o que já está pronto e o que falta, num
            lugar só. Cada item leva pra tela onde se resolve.
          </p>
        </div>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Mês
          <select
            value={month ?? data?.month ?? ""}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          >
            {lastMonths(13).map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading || !data ? (
        <p className="text-sm text-muted">Conferindo o mês...</p>
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-lg border border-gold/40 bg-surface p-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <span className="font-serif text-2xl text-foreground">
                {monthLabel(data.month)}: {data.summary.done} de {data.summary.total} prontos
              </span>
              <span className={`text-sm ${data.summary.pending === 0 ? "text-emerald-400" : "text-amber-300"}`}>
                {data.summary.pending === 0
                  ? data.inProgress
                    ? "Em dia até ontem."
                    : "Mês fechado — os números podem ser usados."
                  : `${data.summary.pending} ${data.summary.pending === 1 ? "pendência" : "pendências"}`}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-background">
              <div
                className={`h-full rounded-full ${data.summary.pending === 0 ? "bg-emerald-400" : "bg-gold"}`}
                style={{ width: `${percent}%` }}
              />
            </div>
            {data.inProgress && (
              <p className="text-xs text-muted">
                Mês em andamento: o checklist confere até ontem. Notas de serviço do ML e PGDAS só saem no mês seguinte.
              </p>
            )}
          </div>

          {GROUP_ORDER.map((group) => {
            const items = data.items.filter((i) => i.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
                <div>
                  <h2 className="font-serif text-lg text-foreground">{group}</h2>
                  <p className="text-xs text-muted">{GROUP_HELP[group]}</p>
                </div>
                <ul className="flex flex-col">
                  {items.map((item) => {
                    const style = STATUS_STYLE[item.status];
                    return (
                      <li key={item.key} className="flex flex-wrap items-start gap-3 border-b border-border/50 py-3 last:border-0">
                        <span className="text-lg leading-none" aria-label={style.label} title={style.label}>
                          {style.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{item.title}</p>
                          <p className={`text-sm ${item.status === "ok" ? "text-muted" : style.className}`}>{item.detail}</p>
                        </div>
                        {item.status !== "ok" && item.status !== "aguardando" && (
                          <Link
                            href={item.href}
                            className="rounded border border-gold px-3 py-1 text-xs whitespace-nowrap text-gold transition hover:bg-gold hover:text-background"
                          >
                            Resolver
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
