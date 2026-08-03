"use client";

import { useEffect, useState } from "react";
import { formatBRL } from "@/lib/format";
import { PeriodFilter } from "@/components/PeriodFilter";

type ExecutiveSummary = {
  period: { year: number; month: number };
  faturamento: number;
  margemBruta: { value: number; percent: number | null };
  margemContribuicao: number;
  lucroLiquido: number;
  pontoDeEquilibrioRevenue: number | null;
  ebitda: number;
  ticketMedio: number | null;
  salesCount: number;
  adSpend: number;
  uniqueCustomers: number;
  cac: number | null;
  cashGeneration: number;
  cashInflow: number;
  cashOutflow: number;
  cogsCoveragePercent: number | null;
};

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

const now = new Date();

export default function ExecutiveDashboardPage() {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/executive?year=${year}&month=${month}`)
      .then((res) => res.json())
      .then((data) => {
        setSummary(data);
        setLoading(false);
      });
  }, [year, month]);

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div>
        <h1 className="font-serif text-2xl text-foreground sm:text-3xl">Dashboard Executivo</h1>
        <p className="text-sm text-muted">
          Os principais números do negócio numa tela só, pra identificar rápido onde está ganhando
          ou perdendo dinheiro.
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

      {loading || !summary ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Faturamento" value={formatBRL(summary.faturamento)} />
            <StatCard
              label="Margem bruta"
              value={formatBRL(summary.margemBruta.value)}
              hint={
                summary.margemBruta.percent !== null
                  ? `${(summary.margemBruta.percent * 100).toFixed(1)}% da receita`
                  : undefined
              }
              tone={summary.margemBruta.value >= 0 ? "positive" : "negative"}
            />
            <StatCard
              label="Margem de contribuição"
              value={formatBRL(summary.margemContribuicao)}
              tone={summary.margemContribuicao >= 0 ? "positive" : "negative"}
            />
            <StatCard
              label="Lucro líquido"
              value={formatBRL(summary.lucroLiquido)}
              tone={summary.lucroLiquido >= 0 ? "positive" : "negative"}
            />
            <StatCard
              label="Ponto de equilíbrio"
              value={
                summary.pontoDeEquilibrioRevenue !== null
                  ? formatBRL(summary.pontoDeEquilibrioRevenue)
                  : "—"
              }
              hint="Faturamento necessário no mês"
            />
            <StatCard
              label="EBITDA"
              value={formatBRL(summary.ebitda)}
              hint="Resultado operacional — sem depreciação/amortização, que não é rastreada"
              tone={summary.ebitda >= 0 ? "positive" : "negative"}
            />
            <StatCard
              label="Ticket médio"
              value={summary.ticketMedio !== null ? formatBRL(summary.ticketMedio) : "—"}
              hint={`${summary.salesCount} venda(s) no período`}
            />
            <StatCard
              label="CAC"
              value={summary.cac !== null ? formatBRL(summary.cac) : "—"}
              hint={
                summary.adSpend === 0
                  ? "Nenhum gasto com publicidade lançado no período"
                  : `${formatBRL(summary.adSpend)} em anúncios ÷ ${summary.uniqueCustomers} cliente(s)`
              }
            />
            <StatCard
              label="Geração de caixa"
              value={formatBRL(summary.cashGeneration)}
              hint={`${formatBRL(summary.cashInflow)} entrou · ${formatBRL(summary.cashOutflow)} saiu`}
              tone={summary.cashGeneration >= 0 ? "positive" : "negative"}
            />
          </div>

          {summary.adSpend === 0 && (
            <p className="text-xs text-muted">
              O CAC só aparece depois que você marcar alguma categoria como "Publicidade/anúncios" em{" "}
              <a href="/categories" className="text-gold hover:underline">
                Categorias
              </a>{" "}
              e lançar os gastos com anúncio nela.
            </p>
          )}

          {summary.cogsCoveragePercent !== null && summary.cogsCoveragePercent < 80 && (
            <p className="text-xs text-muted">
              Margem bruta calculada com só {summary.cogsCoveragePercent.toFixed(0)}% da quantidade
              vendida com custo de tecido/costura/aviamentos cadastrado — cadastre o custo dos
              produtos mais vendidos em{" "}
              <a href="/produtos" className="text-gold hover:underline">
                Produtos
              </a>{" "}
              pra um número mais preciso.
            </p>
          )}
        </>
      )}
    </div>
  );
}
