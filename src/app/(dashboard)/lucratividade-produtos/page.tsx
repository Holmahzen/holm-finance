"use client";

import { useEffect, useMemo, useState } from "react";
import { formatBRL } from "@/lib/format";
import {
  classifyQuadrant,
  QUADRANT_LABEL,
  type AbcTier,
  type ProfitabilityQuadrant,
} from "@/domain/productProfitability";

type Row = {
  sku: string;
  name: string;
  quantity: number;
  grossRevenue: number;
  revenueShare: number;
  cumulativeShare: number;
  tier: AbcTier;
  hasCost: boolean;
  marginValue: number;
  marginPercent: number;
  contribution: number;
};

type Report = { year: number; rows: Row[]; suggestedMarginThreshold: number };

const QUADRANT_EMOJI: Record<ProfitabilityQuadrant, string> = {
  ESTRELA: "🌟",
  MOTOR_MARGEM_APERTADA: "⚠️",
  NICHO_RENTAVEL: "💎",
  REAVALIAR: "🚩",
  SEM_CUSTO: "❔",
};

const QUADRANT_DESCRIPTION: Record<ProfitabilityQuadrant, string> = {
  ESTRELA: "Vende muito (classe A) e tem margem boa — proteger, garantir estoque.",
  MOTOR_MARGEM_APERTADA: "Vende muito mas a margem é baixa — prioridade para revisar preço/custo.",
  NICHO_RENTAVEL: "Vende pouco mas a margem é ótima — vale testar mais anúncio.",
  REAVALIAR: "Vende pouco e a margem é baixa — candidato real a descontinuar.",
  SEM_CUSTO: "Ainda sem tecido/costura/aviamentos cadastrado — não dá para classificar.",
};

const QUADRANT_ORDER: ProfitabilityQuadrant[] = [
  "ESTRELA",
  "MOTOR_MARGEM_APERTADA",
  "NICHO_RENTAVEL",
  "REAVALIAR",
  "SEM_CUSTO",
];

function pct(fraction: number): string {
  return `${(fraction * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

export default function ProductProfitabilityPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [marginThreshold, setMarginThreshold] = useState<number | null>(null);
  const [activeQuadrant, setActiveQuadrant] = useState<ProfitabilityQuadrant | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/products/profitability?year=${year}`)
      .then((r) => r.json())
      .then((body: Report) => {
        setReport(body);
        setMarginThreshold(body.suggestedMarginThreshold);
        setLoading(false);
      });
  }, [year]);

  const rows = useMemo(() => {
    if (!report || marginThreshold === null) return [];
    return report.rows.map((r) => ({
      ...r,
      quadrant: classifyQuadrant(r.tier, r.marginPercent, r.hasCost, marginThreshold),
    }));
  }, [report, marginThreshold]);

  const summary = useMemo(() => {
    const byQuadrant = new Map<ProfitabilityQuadrant, { count: number; contribution: number; revenue: number }>();
    for (const q of QUADRANT_ORDER) byQuadrant.set(q, { count: 0, contribution: 0, revenue: 0 });
    for (const r of rows) {
      const e = byQuadrant.get(r.quadrant)!;
      e.count += 1;
      e.contribution += r.contribution;
      e.revenue += r.grossRevenue;
    }
    return byQuadrant;
  }, [rows]);

  const visibleRows = useMemo(() => {
    const filtered = activeQuadrant ? rows.filter((r) => r.quadrant === activeQuadrant) : rows;
    return [...filtered].sort((a, b) => b.contribution - a.contribution);
  }, [rows, activeQuadrant]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-3xl text-foreground">Lucratividade dos Produtos</h1>
        <p className="max-w-prose text-sm text-muted">
          Cruza quem vende mais (curva ABC pela receita) com quem dá lucro de verdade (margem já
          cadastrada), pra saber onde proteger, onde ajustar preço e o que vale descontinuar — não só
          o que mais vende.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Ano</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          >
            {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">
            Margem considerada &quot;boa&quot; (%)
          </label>
          <input
            type="number"
            step="1"
            value={marginThreshold !== null ? (marginThreshold * 100).toFixed(0) : ""}
            onChange={(e) => setMarginThreshold(Number(e.target.value) / 100)}
            className="w-28 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          />
          {report && (
            <span className="text-xs text-muted">
              Sugestão (mediana do catálogo): {pct(report.suggestedMarginThreshold)}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {QUADRANT_ORDER.map((q) => {
              const s = summary.get(q)!;
              const active = activeQuadrant === q;
              return (
                <button
                  key={q}
                  onClick={() => setActiveQuadrant(active ? null : q)}
                  className={`flex flex-col gap-1 rounded-lg border p-4 text-left transition ${
                    active ? "border-gold bg-gold/10" : "border-border bg-surface hover:border-gold/50"
                  }`}
                >
                  <span className="text-xs font-medium tracking-wide text-muted uppercase">
                    {QUADRANT_EMOJI[q]} {QUADRANT_LABEL[q]}
                  </span>
                  <span className="font-serif text-2xl text-gold">{s.count}</span>
                  <span className="text-xs text-muted">produtos</span>
                  <span className="text-sm text-foreground">
                    {q === "SEM_CUSTO" ? formatBRL(s.revenue) + " em receita" : formatBRL(s.contribution) + " de contribuição"}
                  </span>
                  <span className="text-xs text-muted">{QUADRANT_DESCRIPTION[q]}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl text-foreground">
                {activeQuadrant ? QUADRANT_LABEL[activeQuadrant] : "Todos os produtos"}
              </h2>
              {activeQuadrant && (
                <button
                  onClick={() => setActiveQuadrant(null)}
                  className="text-xs font-medium text-gold hover:text-gold-soft hover:underline"
                >
                  Limpar filtro
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted">
                    <th className="py-2 font-medium">Produto</th>
                    <th className="py-2 font-medium">Classe</th>
                    <th className="py-2 font-medium">Receita</th>
                    <th className="py-2 font-medium">Qtd.</th>
                    <th className="py-2 font-medium">Margem</th>
                    <th className="py-2 font-medium">Contribuição</th>
                    <th className="py-2 font-medium">Grupo</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((r) => (
                    <tr key={r.sku} className="border-b border-border/50">
                      <td className="py-2 max-w-[280px] truncate" title={r.name}>
                        {r.name}
                        <span className="ml-1 text-xs text-muted">({r.sku})</span>
                      </td>
                      <td className="py-2 text-muted">{r.tier}</td>
                      <td className="py-2">{formatBRL(r.grossRevenue)}</td>
                      <td className="py-2">{r.quantity}</td>
                      <td className="py-2">{r.hasCost ? pct(r.marginPercent) : "—"}</td>
                      <td
                        className={`py-2 ${r.hasCost ? (r.contribution >= 0 ? "text-emerald-400" : "text-red-400") : "text-muted"}`}
                      >
                        {r.hasCost ? formatBRL(r.contribution) : "—"}
                      </td>
                      <td className="py-2">
                        {QUADRANT_EMOJI[r.quadrant]} {QUADRANT_LABEL[r.quadrant]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
