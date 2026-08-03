"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatBRL } from "@/lib/format";
import { PeriodFilter } from "@/components/PeriodFilter";
import { HorizontalBarChart } from "@/components/HorizontalBarChart";
import {
  healthSignalText,
  HEALTH_SEVERITY_STYLE,
  HEALTH_SEVERITY_LABEL,
  type HealthSignal,
} from "@/lib/healthSignalText";

type MercadoLivreReceivable = {
  id: string;
  today: string;
  tomorrow: string;
  within7d: string;
  after7d: string;
};

type Summary = {
  period: { year: number; month: number };
  accounts: { id: string; name: string; balance: string }[];
  totalBalance: string;
  entries: {
    payable: { count: number; total: string; overdueCount: number; overdueTotal: string };
    receivable: { count: number; total: string; overdueCount: number; overdueTotal: string };
  };
  reconciliation: { suggestedCount: number; unmatchedCount: number };
  flow: { inflow: string; outflow: string };
  lucroLiquido: number;
  cashFlowAlert: { date: string; runningBalance: number } | null;
  healthSignals: HealthSignal[];
  charts: {
    expensesByCategory: { name: string; total: string }[];
    topSuppliers: { name: string; total: string }[];
    topClients: { name: string; total: string }[];
  };
};

function formatDateLong(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "long",
  });
}

function Card({
  title,
  value,
  subtitle,
  href,
  tone,
}: {
  title: string;
  value: string;
  subtitle?: string;
  href?: string;
  tone?: "default" | "warning" | "positive" | "negative";
}) {
  const toneClass =
    tone === "warning"
      ? "text-amber-400"
      : tone === "positive"
        ? "text-emerald-400"
        : tone === "negative"
          ? "text-red-400"
          : "text-gold";

  const content = (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 transition group-hover:border-gold">
      <span className="text-xs font-medium tracking-wide text-muted uppercase">{title}</span>
      <span className={`font-serif text-2xl ${toneClass}`}>{value}</span>
      {subtitle && <span className="text-xs text-muted">{subtitle}</span>}
    </div>
  );

  return href ? (
    <Link href={href} className="group">
      {content}
    </Link>
  ) : (
    content
  );
}

const now = new Date();

export default function DashboardPage() {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const [mlReceivable, setMlReceivable] = useState<MercadoLivreReceivable | null>(null);
  const [mlExpanded, setMlExpanded] = useState(false);
  const [editingMl, setEditingMl] = useState(false);
  const [mlToday, setMlToday] = useState("");
  const [mlTomorrow, setMlTomorrow] = useState("");
  const [mlWithin7d, setMlWithin7d] = useState("");
  const [mlAfter7d, setMlAfter7d] = useState("");
  const [savingMl, setSavingMl] = useState(false);

  function loadMlReceivable() {
    fetch("/api/mercadolivre-receivables")
      .then((res) => res.json())
      .then((data: MercadoLivreReceivable) => {
        setMlReceivable(data);
        setMlToday(data.today);
        setMlTomorrow(data.tomorrow);
        setMlWithin7d(data.within7d);
        setMlAfter7d(data.after7d);
      });
  }

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/summary?year=${year}&month=${month}`)
      .then((res) => res.json())
      .then((data) => {
        setSummary(data);
        setLoading(false);
      });
  }, [year, month]);

  useEffect(() => {
    loadMlReceivable();
  }, []);

  async function handleSaveMl() {
    setSavingMl(true);
    await fetch("/api/mercadolivre-receivables", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        today: mlToday,
        tomorrow: mlTomorrow,
        within7d: mlWithin7d,
        after7d: mlAfter7d,
      }),
    });
    setSavingMl(false);
    setEditingMl(false);
    loadMlReceivable();
  }

  const mlTotal =
    Number(mlReceivable?.today ?? 0) +
    Number(mlReceivable?.tomorrow ?? 0) +
    Number(mlReceivable?.within7d ?? 0) +
    Number(mlReceivable?.after7d ?? 0);

  const netFlow = summary ? Number(summary.flow.inflow) - Number(summary.flow.outflow) : 0;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-3xl text-foreground">Visão geral</h1>
        <p className="text-sm text-muted">Resumo financeiro da Holm Confecções.</p>
      </div>

      <PeriodFilter
        year={year}
        month={month}
        years={[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]}
        onChange={(y, m) => {
          setYear(y);
          setMonth(m);
        }}
      />

      {loading || !summary ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : (
        <>
          {(summary.cashFlowAlert || summary.healthSignals.length > 0) && (
            <div className="flex flex-col gap-2">
              {summary.cashFlowAlert && (
                <Link
                  href="/fluxo-de-caixa"
                  className="rounded-lg border border-red-400/40 bg-red-400/10 p-4 text-sm text-red-400 transition hover:border-red-400"
                >
                  <span className="mr-1.5 text-xs font-medium tracking-wide uppercase">Alerta</span>
                  Seu saldo projetado fica negativo em{" "}
                  <span className="font-medium">{formatDateLong(summary.cashFlowAlert.date)}</span>,
                  chegando a {formatBRL(summary.cashFlowAlert.runningBalance)}.
                </Link>
              )}
              {summary.healthSignals.map((s, idx) => (
                <Link
                  key={idx}
                  href="/saude-financeira"
                  className={`rounded-lg border px-4 py-2 text-sm transition hover:opacity-90 ${HEALTH_SEVERITY_STYLE[s.severity]}`}
                >
                  <span className="mr-1.5 text-xs font-medium tracking-wide uppercase">
                    {HEALTH_SEVERITY_LABEL[s.severity]}
                  </span>
                  {healthSignalText(s)}
                </Link>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card
              title="Saldo total em contas"
              value={formatBRL(summary.totalBalance)}
              subtitle={`${summary.accounts.length} conta(s) ativa(s)`}
              href="/accounts"
            />
            <Card
              title="Lucro do mês"
              value={formatBRL(summary.lucroLiquido)}
              tone={summary.lucroLiquido >= 0 ? "positive" : "negative"}
              href="/dre"
            />
            <Card
              title="A pagar (pendente)"
              value={formatBRL(summary.entries.payable.total)}
              subtitle={
                summary.entries.payable.overdueCount > 0
                  ? `${summary.entries.payable.overdueCount} vencido(s) — ${formatBRL(summary.entries.payable.overdueTotal)}`
                  : `${summary.entries.payable.count} lançamento(s)`
              }
              tone={summary.entries.payable.overdueCount > 0 ? "warning" : "default"}
              href="/entries"
            />
            <Card
              title="A receber (pendente)"
              value={formatBRL(summary.entries.receivable.total)}
              subtitle={
                summary.entries.receivable.overdueCount > 0
                  ? `${summary.entries.receivable.overdueCount} vencido(s) — ${formatBRL(summary.entries.receivable.overdueTotal)}`
                  : `${summary.entries.receivable.count} lançamento(s)`
              }
              tone={summary.entries.receivable.overdueCount > 0 ? "warning" : "default"}
              href="/entries"
            />
            <Card
              title="Conciliação pendente"
              value={String(
                summary.reconciliation.suggestedCount + summary.reconciliation.unmatchedCount,
              )}
              subtitle={`${summary.reconciliation.suggestedCount} sugestão(ões) + ${summary.reconciliation.unmatchedCount} sem par`}
              tone={
                summary.reconciliation.suggestedCount + summary.reconciliation.unmatchedCount > 0
                  ? "warning"
                  : "default"
              }
              href="/reconciliation"
            />
          </div>

          <div>
            <h2 className="mb-3 font-serif text-xl text-foreground">Patrimônio financeiro</h2>
            <div className="flex flex-wrap items-center gap-3">
              <Card title="Saldo disponível" value={formatBRL(summary.totalBalance)} />
              <span className="font-serif text-2xl text-muted">+</span>
              <Card title="Recebimentos futuros" value={formatBRL(mlTotal)} />
              <span className="font-serif text-2xl text-muted">=</span>
              <Card
                title="Patrimônio financeiro"
                value={formatBRL(Number(summary.totalBalance) + mlTotal)}
                tone="positive"
              />
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-serif text-xl text-foreground">Recebimentos Mercado Livre</h2>
              {!editingMl && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setMlExpanded((v) => !v)}
                    className="text-xs font-medium text-gold hover:text-gold-soft hover:underline"
                  >
                    {mlExpanded ? "Recolher" : "Ver detalhamento"}
                  </button>
                  <button
                    onClick={() => setEditingMl(true)}
                    className="text-xs font-medium text-gold hover:text-gold-soft hover:underline"
                  >
                    Editar
                  </button>
                </div>
              )}
            </div>

            {editingMl ? (
              <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted">Hoje</label>
                  <input
                    type="number"
                    step="0.01"
                    value={mlToday}
                    onChange={(e) => setMlToday(e.target.value)}
                    className="w-28 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted">Amanhã</label>
                  <input
                    type="number"
                    step="0.01"
                    value={mlTomorrow}
                    onChange={(e) => setMlTomorrow(e.target.value)}
                    className="w-28 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted">Até 7 dias</label>
                  <input
                    type="number"
                    step="0.01"
                    value={mlWithin7d}
                    onChange={(e) => setMlWithin7d(e.target.value)}
                    className="w-28 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted">Após 7 dias</label>
                  <input
                    type="number"
                    step="0.01"
                    value={mlAfter7d}
                    onChange={(e) => setMlAfter7d(e.target.value)}
                    className="w-28 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
                  />
                </div>
                <button
                  onClick={handleSaveMl}
                  disabled={savingMl}
                  className="rounded bg-gold px-4 py-1.5 text-sm font-medium text-black transition hover:bg-gold-soft disabled:opacity-50"
                >
                  {savingMl ? "Salvando..." : "Salvar"}
                </button>
                <button
                  onClick={() => setEditingMl(false)}
                  className="text-sm text-muted hover:text-foreground hover:underline"
                >
                  Cancelar
                </button>
              </div>
            ) : mlExpanded ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                <Card title="Hoje" value={formatBRL(mlReceivable?.today ?? 0)} />
                <Card title="Amanhã" value={formatBRL(mlReceivable?.tomorrow ?? 0)} />
                <Card title="Até 7 dias" value={formatBRL(mlReceivable?.within7d ?? 0)} />
                <Card title="Após 7 dias" value={formatBRL(mlReceivable?.after7d ?? 0)} />
                <Card title="Total a liberar" value={formatBRL(mlTotal)} tone="positive" />
              </div>
            ) : (
              <div className="w-fit">
                <Card title="Total a liberar" value={formatBRL(mlTotal)} tone="positive" />
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-3 font-serif text-xl text-foreground">Fluxo do período</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Card title="Entradas" value={formatBRL(summary.flow.inflow)} tone="positive" />
              <Card title="Saídas" value={formatBRL(summary.flow.outflow)} tone="negative" />
              <Card
                title="Saldo do período"
                value={formatBRL(netFlow)}
                tone={netFlow >= 0 ? "positive" : "negative"}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <HorizontalBarChart
              title="Gastos por categoria"
              data={summary.charts.expensesByCategory}
              tone="negative"
            />
            <div className="grid grid-cols-1 gap-4">
              <HorizontalBarChart
                title="Top 5 fornecedores"
                data={summary.charts.topSuppliers}
                tone="negative"
              />
              <HorizontalBarChart
                title="Top 5 clientes"
                data={summary.charts.topClients}
                tone="positive"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
