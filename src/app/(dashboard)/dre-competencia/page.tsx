"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatBRL } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";

type Source = "notas" | "pgdas" | "notas-servico" | "lancamentos" | "estimado";

type Line = {
  key: string;
  label: string;
  value: number;
  kind: "receita" | "deducao" | "subtotal" | "custo" | "resultado";
  source: Source | null;
  note?: string;
  detail?: { label: string; value: number }[];
};

type Report = {
  month: string;
  available: boolean;
  revenueSource: "notas" | "pgdas" | null;
  receitaBruta: number;
  receitaLiquida: number;
  das: number;
  dasSource: Source | null;
  tarifas: number;
  margemContribuicao: number;
  resultado: number;
  cashResult: number;
  hasCosts: boolean;
  lines: Line[];
  replaced: { name: string; value: number; replacedBy: string }[];
  conferencia: { notasLiquidas: number; pgdas: number; diferenca: number } | null;
  warnings: string[];
};

type TrendRow = {
  month: string;
  revenueSource: "notas" | "pgdas" | null;
  receitaBruta: number;
  das: number;
  dasEstimated: boolean;
  tarifas: number;
  margem: number;
  resultado: number;
  cashResult: number;
  hasCosts: boolean;
};

type ApiResponse = { months: string[]; month: string | null; report: Report | null; trend: TrendRow[] };

const MONTH_NAMES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const SOURCE_CHIP: Record<Source, { label: string; className: string }> = {
  notas: { label: "notas fiscais", className: "bg-emerald-500/15 text-emerald-400" },
  pgdas: { label: "PGDAS-D", className: "bg-gold/20 text-gold" },
  "notas-servico": { label: "notas de serviço", className: "bg-sky-500/15 text-sky-300" },
  lancamentos: { label: "lançamentos", className: "bg-surface-hover text-muted" },
  estimado: { label: "estimado", className: "bg-amber-400/15 text-amber-300" },
};

function monthLabel(month: string): string {
  const [year, m] = month.split("-");
  return `${MONTH_NAMES[Number(m) - 1]}/${year}`;
}

function pct(fraction: number): string {
  return `${(fraction * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function StatCard({
  label,
  value,
  note,
  tone = "gold",
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "gold" | "positive" | "negative" | "muted";
}) {
  const color =
    tone === "positive" ? "text-emerald-400" : tone === "negative" ? "text-red-400" : tone === "muted" ? "text-foreground" : "text-gold";
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
      <span className="text-xs font-medium tracking-wide text-muted uppercase">{label}</span>
      <span className={`font-serif text-2xl ${color}`}>{value}</span>
      {note && <span className="text-xs text-muted">{note}</span>}
    </div>
  );
}

function valueClass(line: Line): string {
  if (line.kind === "resultado") return line.value < 0 ? "font-semibold text-red-400" : "font-semibold text-emerald-400";
  if (line.kind === "subtotal") return line.value < 0 ? "font-medium text-red-400" : "font-medium text-gold";
  return "text-foreground";
}

export default function DreCompetenciaPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [month, setMonth] = useState<string | null>(null);

  // O efeito só dispara a busca; o estado muda na resposta.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/dre-competencia${month ? `?month=${month}` : ""}`)
      .then((res) => res.json())
      .then((body: ApiResponse) => {
        if (!cancelled) setData(body);
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  if (!data) return <p className="text-sm text-muted">Carregando...</p>;

  const report = data.report;
  const receita = report?.receitaBruta ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-foreground">DRE por competência</h1>
          <p className="max-w-prose text-sm text-muted">
            O resultado do mês pela data das vendas, e não pela data em que o dinheiro entrou: faturamento das
            notas (ou do PGDAS-D), DAS do extrato e tarifas das notas de serviço. Custos e despesas vêm dos
            lançamentos, como na <Link href="/dre" className="text-gold-soft underline underline-offset-2">DRE</Link>.
          </p>
        </div>
        <PrintButton />
      </div>

      {!report ? (
        <section className="flex max-w-prose flex-col gap-2 rounded-lg border border-border bg-surface p-6 text-sm text-muted">
          <h2 className="font-serif text-xl text-gold">Ainda não há receita por competência</h2>
          <p>
            Importe as notas de venda em{" "}
            <Link href="/notas-fiscais" className="text-gold-soft underline underline-offset-2">Notas Fiscais</Link> ou os
            extratos do PGDAS-D na tela do{" "}
            <Link href="/simples-nacional" className="text-gold-soft underline underline-offset-2">Simples Nacional</Link>.
          </p>
        </section>
      ) : (
        <>
          <div className="no-print flex flex-wrap items-center gap-3">
            <label htmlFor="month" className="text-sm text-muted">
              Mês
            </label>
            <select
              id="month"
              value={data.month ?? ""}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
            >
              {[...data.months].reverse().map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Receita do mês"
              value={formatBRL(report.receitaBruta)}
              note={report.revenueSource === "notas" ? "pelas notas de venda" : "declarada no PGDAS-D"}
            />
            <StatCard
              label="Margem de contribuição"
              value={formatBRL(report.margemContribuicao)}
              note={receita > 0 ? `${pct(report.margemContribuicao / receita)} da receita` : undefined}
              tone={report.margemContribuicao < 0 ? "negative" : "gold"}
            />
            <StatCard
              label="Resultado por competência"
              value={formatBRL(report.resultado)}
              note={
                !report.hasCosts
                  ? "incompleto: poucos custos lançados no mês"
                  : receita > 0
                    ? `${pct(report.resultado / receita)} da receita`
                    : undefined
              }
              tone={!report.hasCosts ? "muted" : report.resultado < 0 ? "negative" : "positive"}
            />
            <StatCard
              label="Resultado na DRE de caixa"
              value={formatBRL(report.cashResult)}
              note={`diferença de ${formatBRL(report.resultado - report.cashResult)} para a competência`}
              tone="muted"
            />
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="font-serif text-xl text-foreground">Demonstração de {monthLabel(report.month)}</h2>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-2xl text-sm">
                <thead className="bg-surface">
                  <tr className="text-xs tracking-wide text-muted uppercase">
                    <th className="px-4 py-3 text-left font-medium">Linha</th>
                    <th className="px-4 py-3 text-right font-medium">Valor</th>
                    <th className="px-4 py-3 text-right font-medium">% da receita</th>
                    <th className="px-4 py-3 text-left font-medium">Fonte</th>
                  </tr>
                </thead>
                <tbody>
                  {report.lines.map((line) => {
                    const strong = line.kind === "subtotal" || line.kind === "resultado";
                    return (
                      <tr
                        key={line.key}
                        className={`border-t border-border align-top ${
                          line.kind === "resultado" ? "bg-gold/10" : strong ? "bg-surface" : ""
                        }`}
                      >
                        <td className="px-4 py-2">
                          {line.detail && line.detail.length > 0 ? (
                            <details>
                              <summary className="cursor-pointer text-foreground">{line.label}</summary>
                              <ul className="mt-1 flex flex-col gap-0.5 pl-4 text-xs text-muted">
                                {line.detail.map((d, i) => (
                                  <li key={`${d.label}-${i}`} className="flex justify-between gap-6">
                                    <span>{d.label}</span>
                                    <span className="tabular-nums">{formatBRL(d.value)}</span>
                                  </li>
                                ))}
                              </ul>
                            </details>
                          ) : (
                            <span className={strong ? "font-medium text-foreground" : "text-foreground"}>{line.label}</span>
                          )}
                          {line.note && <div className="text-xs text-muted">{line.note}</div>}
                        </td>
                        <td className={`px-4 py-2 text-right tabular-nums ${valueClass(line)}`}>{formatBRL(line.value)}</td>
                        <td className="px-4 py-2 text-right text-muted tabular-nums">
                          {receita > 0 ? pct(line.value / receita) : "—"}
                        </td>
                        <td className="px-4 py-2">
                          {line.source && (
                            <span className={`rounded-full px-2 py-0.5 text-xs ${SOURCE_CHIP[line.source].className}`}>
                              {SOURCE_CHIP[line.source].label}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            {report.replaced.length > 0 && (
              <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 text-sm">
                <h2 className="text-xs font-medium tracking-wide text-muted uppercase">Trocado nesta visão</h2>
                <p className="text-xs text-muted">
                  Existe nos lançamentos, mas aqui entra outra fonte — somar os dois contaria o mesmo valor duas vezes.
                </p>
                <ul className="flex flex-col gap-1">
                  {report.replaced.map((r) => (
                    <li key={r.name} className="flex flex-wrap justify-between gap-x-4">
                      <span className="text-foreground">
                        {r.name} <span className="text-muted">→ {r.replacedBy}</span>
                      </span>
                      <span className="text-muted tabular-nums">{formatBRL(r.value)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {(report.warnings.length > 0 || report.conferencia) && (
              <section className="flex flex-col gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-100">
                <h2 className="text-xs font-medium tracking-wide text-amber-300 uppercase">Para ler com cuidado</h2>
                {report.conferencia && (
                  <p>
                    Notas de venda menos devoluções: {formatBRL(report.conferencia.notasLiquidas)}. Receita declarada no
                    PGDAS-D: {formatBRL(report.conferencia.pgdas)}. Diferença de{" "}
                    <strong className="text-amber-300">{formatBRL(report.conferencia.diferenca)}</strong>
                    {Math.abs(report.conferencia.diferenca) >= 1
                      ? " — vale conferir se faltam notas importadas ou se a declaração usou outra base."
                      : "."}
                  </p>
                )}
                <ul className="flex list-disc flex-col gap-1 pl-4">
                  {report.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {data.trend.length > 1 && (
            <section className="flex flex-col gap-3">
              <h2 className="font-serif text-xl text-foreground">Mês a mês</h2>
              <p className="max-w-prose text-sm text-muted">
                Clique num mês para ver a demonstração. A última coluna é o resultado da DRE de caixa, para comparar.
              </p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-3xl text-sm">
                  <thead className="bg-surface">
                    <tr className="text-xs tracking-wide text-muted uppercase">
                      <th className="px-4 py-3 text-left font-medium">Mês</th>
                      <th className="px-4 py-3 text-right font-medium">Receita</th>
                      <th className="px-4 py-3 text-right font-medium">DAS</th>
                      <th className="px-4 py-3 text-right font-medium">Tarifas (notas)</th>
                      <th className="px-4 py-3 text-right font-medium">Margem</th>
                      <th className="px-4 py-3 text-right font-medium">Resultado</th>
                      <th className="px-4 py-3 text-right font-medium">Caixa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.trend].reverse().map((t) => (
                      <tr
                        key={t.month}
                        onClick={() => setMonth(t.month)}
                        className={`cursor-pointer border-t border-border transition hover:bg-surface-hover ${
                          t.month === data.month ? "bg-gold/10" : ""
                        }`}
                      >
                        <td className="px-4 py-2 text-foreground">
                          {monthLabel(t.month)}
                          <span className="ml-2 text-xs text-muted">{t.revenueSource === "notas" ? "notas" : "PGDAS"}</span>
                        </td>
                        <td className="px-4 py-2 text-right text-foreground tabular-nums">{formatBRL(t.receitaBruta)}</td>
                        <td className="px-4 py-2 text-right text-muted tabular-nums">
                          {formatBRL(t.das)}
                          {t.dasEstimated && <span className="ml-1 text-xs text-amber-300">est.</span>}
                        </td>
                        <td className="px-4 py-2 text-right text-muted tabular-nums">{t.tarifas > 0 ? formatBRL(t.tarifas) : "—"}</td>
                        <td className="px-4 py-2 text-right text-muted tabular-nums">{formatBRL(t.margem)}</td>
                        <td
                          className={`px-4 py-2 text-right font-medium tabular-nums ${
                            !t.hasCosts ? "text-muted" : t.resultado < 0 ? "text-red-400" : "text-emerald-400"
                          }`}
                        >
                          {formatBRL(t.resultado)}
                          {!t.hasCosts && <div className="text-xs font-normal text-amber-300">custos incompletos</div>}
                        </td>
                        <td className="px-4 py-2 text-right text-muted tabular-nums">{formatBRL(t.cashResult)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
