"use client";

import { useEffect, useState } from "react";
import { formatBRL } from "@/lib/format";

type Movement = { date: string; amount: number; label: string };
type CashFlowDay = {
  date: string;
  inflow: number;
  outflow: number;
  netChange: number;
  runningBalance: number;
  movements: Movement[];
};

type RealizedToday = {
  inflow: number;
  outflow: number;
  movements: Movement[];
};

type CashFlowReport = {
  startingBalance: number;
  days: CashFlowDay[];
  firstNegativeDay: CashFlowDay | null;
  mlAfter7d: number;
  realizedToday: RealizedToday;
  safeToSpend: number;
  totalPendingOutflows: number;
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

function BalanceChart({ days }: { days: CashFlowDay[] }) {
  const width = 760;
  const height = 180;
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

  const linePath = values.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");
  const hasNegative = values.some((v) => v < 0);

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
        {values.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={v < 0 ? 3 : 2} fill={v < 0 ? "#f87171" : "#D4AF37"}>
            <title>
              {formatDate(days[i].date)}: {formatBRL(v)}
            </title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-muted">
        <span>{formatDate(days[0].date)}</span>
        <span>{formatDate(days[days.length - 1].date)}</span>
      </div>
    </div>
  );
}

function MovementsList({ movements }: { movements: Movement[] }) {
  const [expanded, setExpanded] = useState(false);
  const LIMIT = 8;
  const visible = expanded ? movements : movements.slice(0, LIMIT);
  const hidden = movements.length - visible.length;

  return (
    <ul className="flex flex-col gap-0.5">
      {visible.map((m, idx) => (
        <li key={idx} className={m.amount >= 0 ? "text-emerald-400" : "text-red-400"}>
          {m.label} ({m.amount >= 0 ? "+" : ""}
          {formatBRL(m.amount)})
        </li>
      ))}
      {hidden > 0 && (
        <li>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-xs font-medium text-gold hover:text-gold-soft hover:underline"
          >
            + {hidden} outro(s)
          </button>
        </li>
      )}
    </ul>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative";
}) {
  const toneClass =
    tone === "positive" ? "text-emerald-400" : tone === "negative" ? "text-red-400" : "text-gold";
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
      <span className="text-xs font-medium tracking-wide text-muted uppercase">{label}</span>
      <span className={`font-serif text-2xl ${toneClass}`}>{value}</span>
    </div>
  );
}

export default function CashFlowPage() {
  const [days, setDays] = useState(30);
  const [report, setReport] = useState<CashFlowReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/cash-flow?days=${days}`)
      .then((res) => res.json())
      .then((data) => {
        setReport(data);
        setLoading(false);
      });
  }, [days]);

  const daysWithMovement = report?.days.filter((d) => d.movements.length > 0) ?? [];
  const lowestDay = report?.days.reduce(
    (min, d) => (d.runningBalance < min.runningBalance ? d : min),
    report.days[0],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-foreground">Fluxo de Caixa</h1>
          <p className="text-sm text-muted">
            Projeção do saldo dia a dia, somando o saldo atual das contas com as contas a pagar e a
            receber ainda pendentes (pelas datas de vencimento). Vencidos entram a partir de hoje.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
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
      </div>

      {loading || !report ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : (
        <>
          {report.firstNegativeDay && (
            <div className="rounded-lg border border-red-400/40 bg-red-400/10 p-4 text-sm text-red-400">
              <span className="mr-1.5 text-xs font-medium tracking-wide uppercase">Alerta</span>
              Seu saldo projetado fica negativo em{" "}
              <span className="font-medium">{formatDateLong(report.firstNegativeDay.date)}</span>,
              chegando a {formatBRL(report.firstNegativeDay.runningBalance)} — vai faltar dinheiro
              pra cobrir o que vence até lá, a não ser que entre alguma receita não prevista.
            </div>
          )}

          {report.safeToSpend > 0 ? (
            <div className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 p-4">
              <span className="text-xs font-medium tracking-wide text-emerald-400 uppercase">
                Compras
              </span>
              <p className="font-serif text-2xl text-emerald-400">
                Pode gastar até {formatBRL(report.safeToSpend)}
              </p>
              <p className="text-sm text-emerald-400/80">
                {report.totalPendingOutflows > 0 ? (
                  <>
                    Já descontando {formatBRL(report.totalPendingOutflows)} em contas pendentes
                    (inclusive custos fixos) que vencem nos próximos {days} dias — sem contar com
                    nenhuma entrada futura, nem confirmada.
                  </>
                ) : (
                  "Não há contas pendentes nos próximos dias descontando esse valor."
                )}
              </p>
            </div>
          ) : (
            !report.firstNegativeDay && (
              <div className="rounded-lg border border-red-400/40 bg-red-400/10 p-4 text-sm text-red-400">
                <span className="mr-1.5 text-xs font-medium tracking-wide uppercase">Compras</span>
                Não sobra nada pra gastar agora — as contas pendentes nos próximos {days} dias
                ({formatBRL(report.totalPendingOutflows)}) já consomem todo o saldo atual.
              </div>
            )
          )}

          {report.mlAfter7d > 0 && (
            <p className="text-xs text-muted">
              Além do que já está na projeção abaixo, tem mais {formatBRL(report.mlAfter7d)} do
              Mercado Livre "a liberar depois de 7 dias" (sem data exata cadastrada em Início — não
              entra na curva).
            </p>
          )}

          {report.realizedToday.movements.length > 0 && (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-lg text-foreground">Realizado hoje</h2>
                <div className="flex gap-4 text-sm">
                  {report.realizedToday.inflow > 0 && (
                    <span className="text-emerald-400">+{formatBRL(report.realizedToday.inflow)}</span>
                  )}
                  {report.realizedToday.outflow > 0 && (
                    <span className="text-red-400">-{formatBRL(report.realizedToday.outflow)}</span>
                  )}
                </div>
              </div>
              <MovementsList movements={report.realizedToday.movements} />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Saldo atual" value={formatBRL(report.startingBalance)} />
            <StatCard
              label={`Saldo projetado em ${days} dias`}
              value={formatBRL(report.days[report.days.length - 1].runningBalance)}
              tone={report.days[report.days.length - 1].runningBalance >= 0 ? "positive" : "negative"}
            />
            <StatCard
              label="Menor saldo no período"
              value={lowestDay ? formatBRL(lowestDay.runningBalance) : "—"}
              tone={lowestDay && lowestDay.runningBalance < 0 ? "negative" : "default"}
            />
          </div>

          <BalanceChart days={report.days} />

          <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
            <h2 className="font-serif text-lg text-foreground">Movimentos previstos</h2>
            {daysWithMovement.length === 0 ? (
              <p className="text-sm text-muted">Nenhum lançamento pendente nesse período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted">
                      <th className="py-2 font-medium">Data</th>
                      <th className="py-2 font-medium">Movimentos</th>
                      <th className="py-2 font-medium">Entradas</th>
                      <th className="py-2 font-medium">Saídas</th>
                      <th className="py-2 font-medium">Saldo do dia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daysWithMovement.map((d) => (
                      <tr key={d.date} className="border-b border-border/50 align-top">
                        <td className="py-2 whitespace-nowrap">{formatDate(d.date)}</td>
                        <td className="py-2">
                          <MovementsList movements={d.movements} />
                        </td>
                        <td className="py-2 text-emerald-400">
                          {d.inflow > 0 ? formatBRL(d.inflow) : "—"}
                        </td>
                        <td className="py-2 text-red-400">
                          {d.outflow > 0 ? formatBRL(d.outflow) : "—"}
                        </td>
                        <td
                          className={`py-2 font-medium ${
                            d.runningBalance >= 0 ? "text-foreground" : "text-red-400"
                          }`}
                        >
                          {formatBRL(d.runningBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
