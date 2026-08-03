"use client";

import { useEffect, useState } from "react";
import { formatBRL } from "@/lib/format";
import { PeriodFilter } from "@/components/PeriodFilter";
import { computeBreakEvenTargets, computeEstimatedProfit } from "@/domain/breakEven";

type ProductRanked = {
  id: string;
  name: string;
  sku: string | null;
  avgMonthlyQuantity: number;
  marginValue: number;
  marginPercent: number;
  markupPercent: number;
};

type Insight =
  | { type: "margin_below_threshold"; severity: "critical"; marginPercent: number; threshold: number }
  | { type: "negative_margin_products"; severity: "critical"; count: number; sampleNames: string[] }
  | { type: "negative_estimated_profit"; severity: "warning"; estimatedProfit: number }
  | {
      type: "projection_below_break_even";
      severity: "warning";
      projectedRevenue: number;
      breakEvenRevenue: number;
    }
  | { type: "break_even_reached"; severity: "info"; surplus: number }
  | {
      type: "projection_above_break_even";
      severity: "info";
      projectedRevenue: number;
      breakEvenRevenue: number;
    }
  | { type: "projected_break_even_day"; severity: "info"; day: number };

type RevenueProjection = {
  daysElapsed: number;
  daysInMonth: number;
  dailyPace: number;
  projectedRevenue: number;
};

type BreakEvenReport = {
  period: { year: number; month: number };
  fixedCostsTotal: number;
  actualRevenueThisMonth: number;
  breakEven: {
    weightedMarginPercent: number | null;
    weightedMarkupPercent: number | null;
    weightedAvgUnitMargin: number | null;
    breakEvenRevenue: number | null;
    breakEvenUnits: number | null;
  };
  progress: number | null;
  estimatedProfit: number | null;
  top10: ProductRanked[];
  bottom10: ProductRanked[];
  marginAlertThreshold: number;
  alert: boolean;
  negativeMarginProductsCount: number;
  projection: RevenueProjection | null;
  projectedBreakEvenDay: number | null;
  insights: Insight[];
  dataSource: "vendas" | "produtos";
  productionCostMatchedSkus: number | null;
  productionCostUnmatchedSkus: number | null;
};

function insightText(insight: Insight): string {
  switch (insight.type) {
    case "margin_below_threshold":
      return `Margem de contribuição média (${(insight.marginPercent * 100).toFixed(1)}%) está abaixo do limite de alerta que você definiu (${insight.threshold}%).`;
    case "negative_margin_products": {
      const names = insight.sampleNames.join(", ");
      const extra = insight.count > insight.sampleNames.length ? ` e mais ${insight.count - insight.sampleNames.length}` : "";
      return `${insight.count} produto(s) com margem de contribuição negativa: ${names}${extra}. Cada venda desses produtos gera prejuízo — revise preço ou custo em Produtos.`;
    }
    case "negative_estimated_profit":
      return `O lucro estimado do período está negativo (${formatBRL(insight.estimatedProfit)}) — os custos fixos ainda não estão sendo cobertos pela margem gerada pelo faturamento atual.`;
    case "projection_below_break_even":
      return `No ritmo atual de vendas, a projeção é fechar o mês em ${formatBRL(insight.projectedRevenue)} — abaixo do ponto de equilíbrio (${formatBRL(insight.breakEvenRevenue)}).`;
    case "break_even_reached":
      return `Ponto de equilíbrio já superado neste período, com excedente de ${formatBRL(insight.surplus)}.`;
    case "projection_above_break_even":
      return `No ritmo atual de vendas, a projeção é fechar o mês em ${formatBRL(insight.projectedRevenue)}, superando o ponto de equilíbrio (${formatBRL(insight.breakEvenRevenue)}).`;
    case "projected_break_even_day":
      return `No ritmo atual, você deve bater o ponto de equilíbrio por volta do dia ${insight.day}.`;
  }
}

const SEVERITY_STYLE: Record<Insight["severity"], string> = {
  critical: "border-red-400/40 bg-red-400/10 text-red-400",
  warning: "border-amber-400/40 bg-amber-400/10 text-amber-400",
  info: "border-sky-400/40 bg-sky-400/10 text-sky-400",
};

const SEVERITY_LABEL: Record<Insight["severity"], string> = {
  critical: "Alerta",
  warning: "Atenção",
  info: "Análise",
};

function IntelligencePanel({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-serif text-lg text-foreground">Inteligência</h2>
      <div className="flex flex-col gap-2">
        {insights.map((insight, idx) => (
          <div
            key={idx}
            className={`rounded-lg border px-3 py-2 text-sm ${SEVERITY_STYLE[insight.severity]}`}
          >
            <span className="mr-1.5 text-xs font-medium tracking-wide uppercase">
              {SEVERITY_LABEL[insight.severity]}
            </span>
            {insightText(insight)}
          </div>
        ))}
      </div>
    </div>
  );
}

function WhatIfSimulator({ report }: { report: BreakEvenReport }) {
  const [hypotheticalFixedCosts, setHypotheticalFixedCosts] = useState(
    String(report.fixedCostsTotal),
  );

  const fixedCosts = Number(hypotheticalFixedCosts);
  const valid = hypotheticalFixedCosts !== "" && !Number.isNaN(fixedCosts) && fixedCosts >= 0;

  const targets = valid
    ? computeBreakEvenTargets(
        fixedCosts,
        report.breakEven.weightedMarginPercent,
        report.breakEven.weightedAvgUnitMargin,
      )
    : null;

  const excedente =
    targets?.breakEvenRevenue != null ? report.actualRevenueThisMonth - targets.breakEvenRevenue : null;

  const lucroEstimado = valid
    ? computeEstimatedProfit(report.actualRevenueThisMonth, report.breakEven.weightedMarginPercent, fixedCosts)
    : null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-dashed border-gold/50 bg-surface p-4">
      <div>
        <h2 className="font-serif text-lg text-foreground">Simulador — e se o custo fixo fosse outro?</h2>
        <p className="text-sm text-muted">
          Mantendo a margem de contribuição ({report.breakEven.weightedMarginPercent !== null ? `${(report.breakEven.weightedMarginPercent * 100).toFixed(1)}%` : "—"}) e o
          faturamento atual ({formatBRL(report.actualRevenueThisMonth)}), veja o impacto de um
          custo fixo diferente. É só uma simulação — não altera seus custos fixos reais.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted">Custo fixo hipotético (R$)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={hypotheticalFixedCosts}
          onChange={(e) => setHypotheticalFixedCosts(e.target.value)}
          className="w-40 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Ponto de equilíbrio (R$)"
          value={targets?.breakEvenRevenue != null ? formatBRL(targets.breakEvenRevenue) : "—"}
        />
        <StatCard
          label="Ponto de equilíbrio (unidades/mês)"
          value={targets?.breakEvenUnits != null ? String(Math.ceil(targets.breakEvenUnits)) : "—"}
        />
        <StatCard
          label="Excedente"
          value={excedente !== null ? formatBRL(excedente) : "—"}
          tone={excedente === null ? "default" : excedente >= 0 ? "positive" : "negative"}
        />
        <StatCard
          label="Lucro estimado"
          value={lucroEstimado !== null ? formatBRL(lucroEstimado) : "—"}
          tone={lucroEstimado === null ? "default" : lucroEstimado >= 0 ? "positive" : "negative"}
        />
      </div>
    </div>
  );
}

const now = new Date();

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

function ProgressMeter({
  current,
  target,
}: {
  current: number;
  target: number | null;
}) {
  if (target === null || target <= 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4">
        <p className="text-sm text-muted">
          Não dá pra calcular o progresso — cadastre produtos com margem positiva em{" "}
          <a href="/produtos" className="text-gold hover:underline">
            Produtos
          </a>
          .
        </p>
      </div>
    );
  }

  const percent = (current / target) * 100;
  const reached = percent >= 100;
  const fillPercent = Math.min(percent, 100);
  const fillClass = reached ? "bg-emerald-400" : "bg-amber-400";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-lg text-foreground">Progresso até o ponto de equilíbrio</h2>
        <span className={`font-serif text-xl ${reached ? "text-emerald-400" : "text-amber-400"}`}>
          {percent.toFixed(0)}%
        </span>
      </div>

      <div className="h-3 w-full overflow-hidden rounded-full bg-border">
        <div
          className={`h-full rounded-full transition-[width] ${fillClass}`}
          style={{ width: `${fillPercent}%` }}
        />
      </div>

      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted">
        <span>Faturado: {formatBRL(current)}</span>
        <span>Meta: {formatBRL(target)}</span>
      </div>

      <p className={`text-sm ${reached ? "text-emerald-400" : "text-muted"}`}>
        {reached
          ? `Já superou o ponto de equilíbrio em ${formatBRL(current - target)}.`
          : `Faltam ${formatBRL(target - current)} para atingir o ponto de equilíbrio.`}
      </p>
    </div>
  );
}

function ManagementSummary({ report, monthLabel }: { report: BreakEvenReport; monthLabel: string }) {
  const margin = report.breakEven.weightedMarginPercent;
  const markup = report.breakEven.weightedMarkupPercent;
  const target = report.breakEven.breakEvenRevenue;
  const units = report.breakEven.breakEvenUnits;

  if (margin === null || target === null) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-1 font-serif text-lg text-foreground">Resumo gerencial</h2>
        <p className="text-sm text-muted">
          Ainda não há produtos ativos com quantidade média cadastrada — sem isso não dá pra calcular
          o ponto de equilíbrio. Cadastre em{" "}
          <a href="/produtos" className="text-gold hover:underline">
            Produtos
          </a>
          .
        </p>
      </div>
    );
  }

  const reached = report.progress !== null && report.progress >= 0;

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h2 className="mb-1 font-serif text-lg text-foreground">Resumo gerencial</h2>
      <p className="text-sm leading-relaxed text-foreground">
        Em {monthLabel}, sua margem de contribuição média ponderada está em{" "}
        <span className="font-medium text-gold">{(margin * 100).toFixed(1)}%</span>
        {markup !== null && (
          <>
            {" "}
            (markup médio de <span className="font-medium text-gold">{(markup * 100).toFixed(1)}%</span>)
          </>
        )}
        . Com custos fixos de{" "}
        <span className="font-medium">{formatBRL(report.fixedCostsTotal)}</span>, você
        precisa faturar <span className="font-medium text-gold">{formatBRL(target)}</span>
        {units !== null && (
          <>
            {" "}
            (cerca de <span className="font-medium text-gold">{Math.ceil(units)} unidades</span>)
          </>
        )}{" "}
        no mês pra cobrir tudo. Até agora você faturou{" "}
        <span className="font-medium">{formatBRL(report.actualRevenueThisMonth)}</span>, e{" "}
        <span className={`font-medium ${reached ? "text-emerald-400" : "text-amber-400"}`}>
          {reached
            ? `já superou a meta em ${formatBRL(Math.abs(report.progress ?? 0))}`
            : `ainda faltam ${formatBRL(Math.abs(report.progress ?? 0))} para bater a meta`}
        </span>
        .
        {report.estimatedProfit !== null && (
          <>
            {" "}
            O lucro estimado do período, considerando essa margem média sobre o faturamento real, é
            de{" "}
            <span
              className={`font-medium ${report.estimatedProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}
            >
              {formatBRL(report.estimatedProfit)}
            </span>
            .
          </>
        )}
      </p>
    </div>
  );
}

const MONTH_NAMES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export default function BreakEvenPage() {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState<BreakEvenReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [threshold, setThreshold] = useState("");
  const [savingThreshold, setSavingThreshold] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/break-even?year=${year}&month=${month}`);
    const data: BreakEvenReport = await res.json();
    setReport(data);
    setThreshold(String(data.marginAlertThreshold));
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  async function handleSaveThreshold() {
    setSavingThreshold(true);
    await fetch("/api/break-even/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ marginAlertThreshold: threshold }),
    });
    await load();
    setSavingThreshold(false);
  }

  function renderProductTable(products: ProductRanked[], title: string) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
        <h2 className="font-serif text-lg text-foreground">{title}</h2>
        {products.length === 0 ? (
          <p className="text-sm text-muted">Nenhum produto ativo cadastrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-1.5 font-medium">Produto</th>
                  <th className="py-1.5 font-medium">Margem</th>
                  <th className="py-1.5 font-medium">Qtd./mês</th>
                  <th className="py-1.5 font-medium">Contribuição total</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-border/50">
                    <td className="py-1.5">
                      {p.name}
                      {p.sku && <span className="ml-1 text-xs text-muted">({p.sku})</span>}
                    </td>
                    <td className={`py-1.5 ${p.marginValue >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {formatBRL(p.marginValue)} ({(p.marginPercent * 100).toFixed(1)}% margem
                      · {(p.markupPercent * 100).toFixed(1)}% markup)
                    </td>
                    <td className="py-1.5">{p.avgMonthlyQuantity}</td>
                    <td className="py-1.5">{formatBRL(p.marginValue * p.avgMonthlyQuantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div>
        <h1 className="font-serif text-2xl text-foreground sm:text-3xl">Ponto de equilíbrio</h1>
        <p className="text-sm text-muted">
          Quanto você precisa faturar e vender por mês pra cobrir os custos fixos e variáveis, com
          base no mix médio de produtos cadastrado em{" "}
          <a href="/produtos" className="text-gold hover:underline">
            Produtos
          </a>
          .
        </p>
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

      {loading || !report ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : (
        <>
          <p className="text-xs text-muted">
            {report.dataSource === "vendas" ? (
              <>
                Dados deste período vêm das vendas importadas em{" "}
                <a href="/vendas" className="text-gold hover:underline">
                  Vendas
                </a>{" "}
                (quantidade e receita reais por SKU).
              </>
            ) : (
              <>
                Nenhuma venda importada para este período — usando os valores cadastrados manualmente
                em{" "}
                <a href="/produtos" className="text-gold hover:underline">
                  Produtos
                </a>
                .
              </>
            )}
          </p>

          {report.dataSource === "vendas" &&
            report.productionCostUnmatchedSkus !== null &&
            report.productionCostUnmatchedSkus > 0 && (
              <p className="text-xs text-amber-400">
                {report.productionCostMatchedSkus} de{" "}
                {(report.productionCostMatchedSkus ?? 0) + report.productionCostUnmatchedSkus} SKUs
                vendidos já descontam o custo de tecido/costura/aviamentos na margem abaixo — os
                outros {report.productionCostUnmatchedSkus} ainda não têm custo cadastrado em{" "}
                <a href="/produtos" className="text-gold hover:underline">
                  Produtos
                </a>{" "}
                e entram com margem só líquida do Mercado Livre (mais otimista que a real).
              </p>
            )}

          <ManagementSummary report={report} monthLabel={MONTH_NAMES[month - 1]} />

          <IntelligencePanel insights={report.insights} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <StatCard
              label="Ponto de equilíbrio (R$)"
              value={
                report.breakEven.breakEvenRevenue !== null
                  ? formatBRL(report.breakEven.breakEvenRevenue)
                  : "—"
              }
            />
            <StatCard
              label="Ponto de equilíbrio (unidades/mês)"
              value={
                report.breakEven.breakEvenUnits !== null
                  ? String(Math.ceil(report.breakEven.breakEvenUnits))
                  : "—"
              }
            />
            <StatCard
              label="Margem de contribuição média"
              value={
                report.breakEven.weightedMarginPercent !== null
                  ? `${(report.breakEven.weightedMarginPercent * 100).toFixed(1)}%`
                  : "—"
              }
            />
            <StatCard
              label="Markup médio"
              value={
                report.breakEven.weightedMarkupPercent !== null
                  ? `${(report.breakEven.weightedMarkupPercent * 100).toFixed(1)}%`
                  : "—"
              }
            />
            <StatCard
              label="Excedente"
              value={report.progress !== null ? formatBRL(report.progress) : "—"}
              tone={report.progress === null ? "default" : report.progress >= 0 ? "positive" : "negative"}
            />
            <StatCard
              label="Lucro estimado"
              value={report.estimatedProfit !== null ? formatBRL(report.estimatedProfit) : "—"}
              tone={
                report.estimatedProfit === null
                  ? "default"
                  : report.estimatedProfit >= 0
                    ? "positive"
                    : "negative"
              }
            />
          </div>

          <WhatIfSimulator report={report} />

          {report.projection && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <StatCard
                label="Faturamento projetado (mês)"
                value={formatBRL(report.projection.projectedRevenue)}
              />
              <StatCard
                label="Previsão de bater a meta"
                value={
                  report.projectedBreakEvenDay !== null
                    ? `Dia ${report.projectedBreakEvenDay}`
                    : "Não deve bater neste mês"
                }
                tone={report.projectedBreakEvenDay !== null ? "positive" : "negative"}
              />
            </div>
          )}

          <ProgressMeter
            current={report.actualRevenueThisMonth}
            target={report.breakEven.breakEvenRevenue}
          />

          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted">Limite de alerta de margem (%)</label>
              <input
                type="number"
                step="0.1"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="w-28 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
              />
            </div>
            <button
              onClick={handleSaveThreshold}
              disabled={savingThreshold}
              className="rounded bg-gold px-4 py-1.5 text-sm font-medium text-black transition hover:bg-gold-soft disabled:opacity-50"
            >
              {savingThreshold ? "Salvando..." : "Salvar limite"}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {renderProductTable(report.top10, "Top 10 — maior margem de contribuição")}
            {renderProductTable(report.bottom10, "Top 10 — menor margem de contribuição")}
          </div>
        </>
      )}
    </div>
  );
}
