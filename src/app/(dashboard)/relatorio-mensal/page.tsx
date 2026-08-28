"use client";

import { useEffect, useState } from "react";
import { formatBRL } from "@/lib/format";
import { PeriodFilter } from "@/components/PeriodFilter";
import { PrintButton } from "@/components/PrintButton";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

type GrowthMetric = { atual: number; anterior: number; percent: number };
type TopProduct = { sku: string; name: string; quantity: number; grossRevenue: number };

type MonthlyReport = {
  period: { year: number; month: number };
  previousPeriod: { year: number; month: number };
  dre: { receitaBruta: { total: number }; lucroLiquido: number };
  growth: { receitaBruta: GrowthMetric; lucroLiquido: GrowthMetric };
  salesSummary: {
    totalGrossRevenue: number;
    totalNetRevenue: number;
    totalQuantity: number;
    salesCount: number;
    topProducts: TopProduct[];
  };
  nextMonthProjection: {
    period: { year: number; month: number };
    days: number;
    hasSalesPace: boolean;
    projectedRevenue: number;
    projectedProfit: number | null;
  };
};

function periodLabel(p: { year: number; month: number }) {
  return `${MONTHS[p.month - 1]}/${p.year}`;
}

function GrowthCard({ title, metric }: { title: string; metric: GrowthMetric }) {
  const positive = metric.percent >= 0;
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
      <span className="text-xs font-medium tracking-wide text-muted uppercase">{title}</span>
      <span className="font-serif text-2xl text-foreground">{formatBRL(metric.atual)}</span>
      <span className={`text-sm font-medium ${positive ? "text-emerald-400" : "text-red-400"}`}>
        {positive ? "+" : ""}
        {metric.percent.toFixed(1)}% vs. mês anterior ({formatBRL(metric.anterior)})
      </span>
    </div>
  );
}

const now = new Date();

export default function RelatorioMensalPage() {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/monthly-report?year=${year}&month=${month}`)
      .then((res) => res.json())
      .then((data) => {
        setReport(data);
        setLoading(false);
      });
  }, [year, month]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-foreground">Relatório Mensal</h1>
          <p className="no-print text-sm text-muted">
            Crescimento em relação ao mês anterior, resultado das vendas e projeção do mês que vem.
          </p>
        </div>
        <PrintButton />
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
          <div>
            <h2 className="mb-3 font-serif text-xl text-foreground">Crescimento</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GrowthCard title="Receita Bruta" metric={report.growth.receitaBruta} />
              <GrowthCard title="Lucro Líquido" metric={report.growth.lucroLiquido} />
            </div>
          </div>

          <div>
            <h2 className="mb-3 font-serif text-xl text-foreground">Resultado de Vendas</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-lg border border-border bg-surface p-4">
                <span className="text-xs font-medium tracking-wide text-muted uppercase">
                  Receita Bruta
                </span>
                <p className="font-serif text-xl text-foreground">
                  {formatBRL(report.salesSummary.totalGrossRevenue)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-4">
                <span className="text-xs font-medium tracking-wide text-muted uppercase">
                  Receita Líquida
                </span>
                <p className="font-serif text-xl text-foreground">
                  {formatBRL(report.salesSummary.totalNetRevenue)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-4">
                <span className="text-xs font-medium tracking-wide text-muted uppercase">
                  Peças vendidas
                </span>
                <p className="font-serif text-xl text-foreground">{report.salesSummary.totalQuantity}</p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-4">
                <span className="text-xs font-medium tracking-wide text-muted uppercase">
                  Nº de vendas
                </span>
                <p className="font-serif text-xl text-foreground">{report.salesSummary.salesCount}</p>
              </div>
            </div>

            {report.salesSummary.topProducts.length > 0 && (
              <div className="mt-4 rounded-lg border border-border bg-surface p-4">
                <h3 className="mb-2 text-sm font-medium text-foreground">Top 5 produtos</h3>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted">
                      <th className="py-2 font-medium">Produto</th>
                      <th className="py-2 font-medium">SKU</th>
                      <th className="py-2 font-medium">Qtd.</th>
                      <th className="py-2 font-medium">Receita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.salesSummary.topProducts.map((p) => (
                      <tr key={p.sku} className="border-b border-border/50">
                        <td className="py-2">{p.name}</td>
                        <td className="py-2 text-muted">{p.sku}</td>
                        <td className="py-2">{p.quantity}</td>
                        <td className="py-2">{formatBRL(p.grossRevenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h2 className="font-serif text-xl text-foreground">
              Projeção — {periodLabel(report.nextMonthProjection.period)}
            </h2>
            <p className="mb-3 text-xs text-muted">
              Calculada a partir de hoje, sempre pro mês seguinte ao atual — independente do período
              selecionado acima.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-surface p-4">
                <span className="text-xs font-medium tracking-wide text-muted uppercase">
                  Receita projetada
                </span>
                <p className="font-serif text-2xl text-foreground">
                  {formatBRL(report.nextMonthProjection.projectedRevenue)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-4">
                <span className="text-xs font-medium tracking-wide text-muted uppercase">
                  Lucro projetado
                </span>
                <p
                  className={`font-serif text-2xl ${
                    (report.nextMonthProjection.projectedProfit ?? 0) >= 0
                      ? "text-emerald-400"
                      : "text-red-400"
                  }`}
                >
                  {report.nextMonthProjection.projectedProfit !== null
                    ? formatBRL(report.nextMonthProjection.projectedProfit)
                    : "—"}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted">
              Extrapola o ritmo diário de vendas do mês corrente pros{" "}
              {report.nextMonthProjection.days} dias de {periodLabel(report.nextMonthProjection.period)}{" "}
              — assume ritmo constante, não é uma previsão precisa.
              {!report.nextMonthProjection.hasSalesPace &&
                " Poucos dias de dados ainda esse mês pra confiar nesse ritmo."}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
