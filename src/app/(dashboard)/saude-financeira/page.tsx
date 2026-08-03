"use client";

import { useEffect, useState } from "react";
import { formatBRL } from "@/lib/format";
import {
  healthSignalText,
  HEALTH_SEVERITY_STYLE,
  HEALTH_SEVERITY_LABEL,
  type HealthSignal,
} from "@/lib/healthSignalText";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

type CategoryTotal = { categoryId: string; name: string; total: number };

type SeriesPoint = {
  year: number;
  month: number;
  receitaLiquida: number;
  despesasFixas: number;
  despesasFixasByCategory: CategoryTotal[];
  margemContribuicaoPercent: number | null;
  lucroLiquido: number;
  saldoConta: number | null;
};

type HealthReport = { series: SeriesPoint[]; signals: HealthSignal[] };

function monthLabel(p: { year: number; month: number }) {
  return `${MONTHS[p.month - 1]}/${String(p.year).slice(2)}`;
}

function TrendChart({
  title,
  points,
  values,
  formatValue,
  colorClass = "text-gold",
  strokeColor = "#D4AF37",
}: {
  title: string;
  points: { year: number; month: number }[];
  values: (number | null)[];
  formatValue: (v: number) => string;
  colorClass?: string;
  strokeColor?: string;
}) {
  const width = 600;
  const height = 140;
  const padTop = 16;
  const padBottom = 24;
  const padX = 8;

  const validIdx = values.map((v, i) => (v !== null ? i : -1)).filter((i) => i >= 0);
  const validValues = validIdx.map((i) => values[i] as number);
  const last = validValues.length > 0 ? validValues[validValues.length - 1] : null;

  if (validValues.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4">
        <h3 className="font-serif text-base text-foreground">{title}</h3>
        <p className="mt-2 text-sm text-muted">Sem dados suficientes ainda.</p>
      </div>
    );
  }

  const min = Math.min(0, ...validValues);
  const max = Math.max(0, ...validValues);
  const range = max - min || 1;

  const n = values.length;
  const x = (i: number) => padX + (i / (n - 1 || 1)) * (width - padX * 2);
  const y = (v: number) => padTop + (1 - (v - min) / range) * (height - padTop - padBottom);
  const zeroY = y(0);

  const segments: { d: string }[] = [];
  let current: string[] = [];
  values.forEach((v, i) => {
    if (v === null) {
      if (current.length > 1) segments.push({ d: current.join(" ") });
      current = [];
      return;
    }
    current.push(`${i === 0 || current.length === 0 ? "M" : "L"} ${x(i)} ${y(v)}`);
  });
  if (current.length > 1) segments.push({ d: current.join(" ") });

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-serif text-base text-foreground">{title}</h3>
        {last !== null && (
          <span className={`font-serif text-xl ${colorClass}`}>{formatValue(last)}</span>
        )}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 w-full" preserveAspectRatio="none">
        {min < 0 && max > 0 && (
          <line x1={padX} y1={zeroY} x2={width - padX} y2={zeroY} stroke="#3a3a38" strokeWidth={1} />
        )}
        {segments.map((seg, idx) => (
          <path key={idx} d={seg.d} fill="none" stroke={strokeColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {validIdx.map((i) => (
          <circle key={i} cx={x(i)} cy={y(values[i] as number)} r={3} fill={strokeColor}>
            <title>
              {monthLabel(points[i])}: {formatValue(values[i] as number)}
            </title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-muted">
        <span>{monthLabel(points[0])}</span>
        <span>{monthLabel(points[points.length - 1])}</span>
      </div>
    </div>
  );
}

export default function SaudeFinanceiraPage() {
  const [months, setMonths] = useState(12);
  const [report, setReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/health?months=${months}`)
      .then((res) => res.json())
      .then((data) => {
        setReport(data);
        setLoading(false);
      });
  }, [months]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-foreground">Saúde Financeira</h1>
          <p className="text-sm text-muted">
            Evolução dos últimos meses e diagnóstico automático: a empresa está crescendo ou tem
            sinais de problema financeiro?
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          {[6, 12, 24].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMonths(m)}
              className={
                m === months
                  ? "rounded bg-gold px-3 py-1.5 text-sm font-medium text-black"
                  : "rounded px-3 py-1.5 text-sm font-medium text-muted transition hover:text-foreground"
              }
            >
              {m} meses
            </button>
          ))}
        </div>
      </div>

      {loading || !report ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
            <h2 className="font-serif text-lg text-foreground">Diagnóstico</h2>
            {report.signals.length === 0 ? (
              <p className="text-sm text-muted">
                Nenhum sinal de alerta ou de crescimento consistente identificado no período — os
                números estão estáveis.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {report.signals.map((s, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg border px-3 py-2 text-sm ${HEALTH_SEVERITY_STYLE[s.severity]}`}
                  >
                    <span className="mr-1.5 text-xs font-medium tracking-wide uppercase">
                      {HEALTH_SEVERITY_LABEL[s.severity]}
                    </span>
                    {healthSignalText(s)}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TrendChart
              title="Receita líquida"
              points={report.series}
              values={report.series.map((p) => p.receitaLiquida)}
              formatValue={formatBRL}
              colorClass="text-gold"
              strokeColor="#D4AF37"
            />
            <TrendChart
              title="Margem de contribuição (%)"
              points={report.series}
              values={report.series.map((p) => p.margemContribuicaoPercent)}
              formatValue={(v) => `${v.toFixed(1)}%`}
              colorClass="text-sky-400"
              strokeColor="#38bdf8"
            />
            <TrendChart
              title="Lucro líquido"
              points={report.series}
              values={report.series.map((p) => p.lucroLiquido)}
              formatValue={formatBRL}
              colorClass={
                (report.series.at(-1)?.lucroLiquido ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"
              }
              strokeColor={(report.series.at(-1)?.lucroLiquido ?? 0) >= 0 ? "#34d399" : "#f87171"}
            />
            <TrendChart
              title="Saldo em conta"
              points={report.series}
              values={report.series.map((p) => p.saldoConta)}
              formatValue={formatBRL}
              colorClass={
                (report.series.at(-1)?.saldoConta ?? 0) >= 0 ? "text-emerald-400" : "text-red-400"
              }
              strokeColor={(report.series.at(-1)?.saldoConta ?? 0) >= 0 ? "#34d399" : "#f87171"}
            />
          </div>
        </>
      )}
    </div>
  );
}
