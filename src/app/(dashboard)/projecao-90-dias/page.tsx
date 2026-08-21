"use client";

import { useEffect, useState } from "react";
import { formatBRL } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";

type CashFlowDay = {
  date: string;
  runningBalance: number;
};

type RevenueProfitProjection = {
  days: number;
  dailyRevenuePace: number;
  projectedRevenue: number;
  dailyTargetPace: number | null;
  targetRevenue: number | null;
  progressVsTarget: number | null;
  dailyProfitPace: number | null;
  projectedProfit: number | null;
};

type ProjectionReport = {
  days: number;
  hasSalesPace: boolean;
  revenueProfit: RevenueProfitProjection;
  startingBalance: number;
  cashDays: CashFlowDay[];
  firstNegativeDay: CashFlowDay | null;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function formatDateLong(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "long",
  });
}

function StatCard({
  label,
  value,
  tone = "default",
  hint,
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative";
  hint?: string;
}) {
  const toneClass =
    tone === "positive" ? "text-emerald-400" : tone === "negative" ? "text-red-400" : "text-gold";
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
      <span className="text-xs font-medium tracking-wide text-muted uppercase">{label}</span>
      <span className={`font-serif text-2xl ${toneClass}`}>{value}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

function BalanceChart({ days }: { days: CashFlowDay[] }) {
  const width = 760;
  const height = 160;
  const padTop = 16;
  const padBottom = 24;
  const padX = 8;

  const values = days.map((d) => d.runningBalance);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;

  const n = values.length;
  const x = (i: number) => padX + (i / (n - 1 || 1)) * (width - padX * 2);
  const y = (v: number) => padTop + (1 - (v - min) / range) * (height - padTop - padBottom);
  const zeroY = y(0);
  const hasNegative = values.some((v) => v < 0);

  const linePath = values.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
        {min < 0 && max > 0 && (
          <line
            x1={padX}
            y1={zeroY}
            x2={width - padX}
            y2={zeroY}
            stroke="#3a3a38"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        )}
        <path
          d={linePath}
          fill="none"
          stroke={hasNegative ? "#f87171" : "#D4AF37"}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="mt-1 flex justify-between text-xs text-muted">
        <span>{formatDate(days[0].date)}</span>
        <span>{formatDate(days[days.length - 1].date)}</span>
      </div>
    </div>
  );
}

export default function CompanyProjectionPage() {
  const [days, setDays] = useState(90);
  const [report, setReport] = useState<ProjectionReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/company-projection?days=${days}`)
      .then((res) => res.json())
      .then((data) => {
        setReport(data);
        setLoading(false);
      });
  }, [days]);

  const rp = report?.revenueProfit;
  const finalCommittedBalance = report ? report.cashDays[report.cashDays.length - 1].runningBalance : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-foreground">Projeção da empresa</h1>
          <p className="no-print text-sm text-muted">
            Como você deve estar daqui a {days} dias, extrapolando o ritmo de vendas do mês corrente
            (mesmo ritmo usado em{" "}
            <a href="/ponto-de-equilibrio" className="text-gold hover:underline">
              Ponto de Equilíbrio
            </a>
            ) — é uma estimativa direcional, não uma previsão exata, porque assume ritmo constante,
            sem sazonalidade.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="no-print flex gap-1 rounded-lg border border-border bg-surface p-1">
            {[30, 60, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={
                  d === days
                    ? "rounded bg-gold px-3 py-1.5 text-sm font-medium text-black"
                    : "rounded px-3 py-1.5 text-sm font-medium text-muted transition hover:text-foreground"
                }
              >
                {d} dias
              </button>
            ))}
          </div>
          <PrintButton />
        </div>
      </div>

      {loading || !report || !rp ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : !report.hasSalesPace ? (
        <p className="text-sm text-muted">
          Ainda não há vendas suficientes neste mês pra calcular um ritmo diário e projetar — importe
          vendas em{" "}
          <a href="/vendas" className="text-gold hover:underline">
            Vendas
          </a>
          .
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
            <h2 className="font-serif text-lg text-foreground">Faturamento e lucro projetados</h2>
            <p className="text-sm text-muted">
              No ritmo atual de {formatBRL(rp.dailyRevenuePace)}/dia, em {days} dias você deve
              faturar{" "}
              <span className="font-medium text-gold">{formatBRL(rp.projectedRevenue)}</span>
              {rp.targetRevenue !== null && (
                <>
                  {" "}
                  — a meta pro mesmo período (ponto de equilíbrio extrapolado) é{" "}
                  <span className="font-medium">{formatBRL(rp.targetRevenue)}</span>, então você deve{" "}
                  <span
                    className={`font-medium ${
                      (rp.progressVsTarget ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}
                  >
                    {(rp.progressVsTarget ?? 0) >= 0
                      ? `superar a meta em ${formatBRL(Math.abs(rp.progressVsTarget ?? 0))}`
                      : `ficar ${formatBRL(Math.abs(rp.progressVsTarget ?? 0))} abaixo da meta`}
                  </span>
                </>
              )}
              .
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={`Faturamento projetado (${days} dias)`}
              value={formatBRL(rp.projectedRevenue)}
            />
            <StatCard
              label={`Meta pro período (${days} dias)`}
              value={rp.targetRevenue !== null ? formatBRL(rp.targetRevenue) : "—"}
            />
            <StatCard
              label="Diferença vs. meta"
              value={rp.progressVsTarget !== null ? formatBRL(rp.progressVsTarget) : "—"}
              tone={
                rp.progressVsTarget === null ? "default" : rp.progressVsTarget >= 0 ? "positive" : "negative"
              }
            />
            <StatCard
              label={`Lucro projetado (${days} dias)`}
              value={rp.projectedProfit !== null ? formatBRL(rp.projectedProfit) : "—"}
              tone={rp.projectedProfit === null ? "default" : rp.projectedProfit >= 0 ? "positive" : "negative"}
              hint="Faturamento × margem de contribuição média, menos os custos fixos do período"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-serif text-lg text-foreground">
                Saldo de caixa comprometido em {days} dias
              </h2>
            </div>
            <p className="text-sm text-muted">
              Essa linha soma só o que já está lançado (contas a pagar e a receber pendentes) — não
              inclui o faturamento projetado acima, porque essas vendas ainda não aconteceram. Pra ver
              o detalhe dia a dia, use{" "}
              <a href="/fluxo-de-caixa" className="text-gold hover:underline">
                Fluxo de Caixa
              </a>
              .
            </p>

            {report.firstNegativeDay && (
              <div className="rounded-lg border border-red-400/40 bg-red-400/10 p-3 text-sm text-red-400">
                <span className="mr-1.5 text-xs font-medium tracking-wide uppercase">Alerta</span>
                Saldo comprometido fica negativo em{" "}
                <span className="font-medium">{formatDateLong(report.firstNegativeDay.date)}</span>,
                chegando a {formatBRL(report.firstNegativeDay.runningBalance)}.
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <StatCard label="Saldo atual" value={formatBRL(report.startingBalance)} />
              <StatCard
                label={`Saldo comprometido em ${days} dias`}
                value={finalCommittedBalance !== null ? formatBRL(finalCommittedBalance) : "—"}
                tone={
                  finalCommittedBalance === null ? "default" : finalCommittedBalance >= 0 ? "positive" : "negative"
                }
              />
            </div>

            <BalanceChart days={report.cashDays} />
          </div>
        </>
      )}
    </div>
  );
}
