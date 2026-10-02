"use client";

import { Fragment, useEffect, useState } from "react";
import { formatBRL } from "@/lib/format";

type SizeReturns = {
  sku: string;
  size: string | null;
  soldQty: number;
  soldValue: number;
  returnedQty: number;
  returnedValue: number;
  returnRate: number | null;
};

type ModelReturns = Omit<SizeReturns, "sku" | "size"> & { key: string; label: string; name: string; sizes: SizeReturns[] };

type Report = {
  from: string;
  to: string;
  months: number;
  soldQty: number;
  soldValue: number;
  returnedQty: number;
  returnedValue: number;
  returnRate: number | null;
  models: ModelReturns[];
  unmatched: { code: string; description: string; returnedQty: number; returnedValue: number }[];
};

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5)) - 1]}/${m.slice(2, 4)}`;
const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1).replace(".", ",")}%`);
const qty = (v: number) => Math.round(v).toLocaleString("pt-BR");

/** Pinta a taxa contra a média da loja: bem acima da média é onde investigar. */
function rateTone(rate: number | null, average: number | null) {
  if (rate === null || average === null) return "text-muted";
  if (rate >= average * 2 && rate >= 0.05) return "text-red-400";
  if (rate >= average * 1.3) return "text-amber-300";
  return "text-emerald-400";
}

export default function DevolucoesPage() {
  const [months, setMonths] = useState(3);
  const [data, setData] = useState<Report | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [minSold, setMinSold] = useState(20);

  useEffect(() => {
    fetch(`/api/product-returns?months=${months}`)
      .then((res) => res.json())
      .then(setData);
  }, [months]);

  const loading = !data || data.months !== months;
  const average = data?.returnRate ?? null;
  const visible = data ? data.models.filter((m) => m.returnedQty > 0 && m.soldQty >= minSold) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl text-foreground">Devoluções por produto</h1>
        <p className="max-w-prose text-sm text-muted">
          Quais modelos e tamanhos mais voltam, pelas notas fiscais de venda e de devolução (cruzadas pelo SKU). A
          devolução de um mês costuma ser de venda do mês anterior, por isso a taxa olha alguns meses juntos. Tamanho com
          taxa muito acima dos outros do mesmo modelo costuma ser tabela de medidas — vale revisar o anúncio.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-surface p-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Período
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          >
            <option value={1}>Mês passado</option>
            <option value={3}>Últimos 3 meses</option>
            <option value={6}>Últimos 6 meses</option>
            <option value={12}>Últimos 12 meses</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Mostrar modelos com pelo menos
          <select
            value={minSold}
            onChange={(e) => setMinSold(Number(e.target.value))}
            className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          >
            <option value={1}>1 peça vendida</option>
            <option value={20}>20 peças vendidas</option>
            <option value={100}>100 peças vendidas</option>
          </select>
        </label>
        {data && !loading && (
          <span className="pb-2 text-xs text-muted">
            {monthLabel(data.from)} a {monthLabel(data.to)}
          </span>
        )}
      </div>

      {loading || !data ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-surface p-4">
              <span className="text-xs font-medium tracking-wide text-muted uppercase">Devolvido</span>
              <p className="font-serif text-2xl text-red-400">{formatBRL(data.returnedValue)}</p>
              <span className="text-xs text-muted">{qty(data.returnedQty)} peças</span>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <span className="text-xs font-medium tracking-wide text-muted uppercase">Taxa de devolução da loja</span>
              <p className="font-serif text-2xl text-gold">{pct(data.returnRate)}</p>
              <span className="text-xs text-muted">das peças vendidas no período</span>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <span className="text-xs font-medium tracking-wide text-muted uppercase">Vendido</span>
              <p className="font-serif text-2xl text-foreground">{formatBRL(data.soldValue)}</p>
              <span className="text-xs text-muted">{qty(data.soldQty)} peças</span>
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma devolução neste filtro.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-surface p-4">
              <p className="mb-2 text-xs text-muted">
                Ordenado pelo valor devolvido. <span className="text-red-400">Vermelho</span>: o dobro da média da loja ou
                mais; <span className="text-amber-300">amarelo</span>: 30% acima da média. Clique no modelo pra ver os
                tamanhos.
              </p>
              <table className="w-full min-w-2xl text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted">
                    <th className="py-2 font-medium">Modelo</th>
                    <th className="py-2 text-right font-medium">Vendidas</th>
                    <th className="py-2 text-right font-medium">Devolvidas</th>
                    <th className="py-2 text-right font-medium">Taxa</th>
                    <th className="py-2 text-right font-medium">Valor devolvido</th>
                    <th className="py-2 pl-4 font-medium">Tamanho que mais volta</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((m) => {
                    const worst = [...m.sizes]
                      .filter((s) => s.returnedQty > 0 && s.soldQty >= 5)
                      .sort((a, b) => (b.returnRate ?? 0) - (a.returnRate ?? 0))[0];
                    return (
                      <Fragment key={m.key}>
                        <tr
                          className="cursor-pointer border-b border-border/50 align-top hover:bg-background/40"
                          onClick={() => setOpen(open === m.key ? null : m.key)}
                        >
                          <td className="py-2 pr-4">
                            <span className="font-medium text-foreground">
                              {open === m.key ? "▾" : "▸"} {m.label}
                            </span>
                            <span className="block max-w-xs truncate text-xs text-muted" title={m.name}>
                              {m.name}
                            </span>
                          </td>
                          <td className="py-2 text-right tabular-nums">{qty(m.soldQty)}</td>
                          <td className="py-2 text-right tabular-nums">{qty(m.returnedQty)}</td>
                          <td className={`py-2 text-right font-medium tabular-nums ${rateTone(m.returnRate, average)}`}>
                            {pct(m.returnRate)}
                          </td>
                          <td className="py-2 text-right tabular-nums">{formatBRL(m.returnedValue)}</td>
                          <td className="py-2 pl-4 text-sm">
                            {worst && m.sizes.length > 1 ? (
                              <span className={rateTone(worst.returnRate, m.returnRate)}>
                                {worst.size ?? worst.sku}: {pct(worst.returnRate)}
                              </span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                        </tr>
                        {open === m.key && (
                          <tr>
                            <td colSpan={6} className="pb-4">
                              <table className="ml-4 w-full max-w-2xl text-sm">
                                <thead>
                                  <tr className="text-xs text-muted">
                                    <th className="py-1 text-left font-medium">Tamanho / SKU</th>
                                    <th className="py-1 text-right font-medium">Vendidas</th>
                                    <th className="py-1 text-right font-medium">Devolvidas</th>
                                    <th className="py-1 text-right font-medium">Taxa</th>
                                    <th className="py-1 text-right font-medium">Valor devolvido</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {m.sizes.map((s) => (
                                    <tr key={s.sku} className="border-t border-border/40">
                                      <td className="py-1">
                                        <span className="font-medium">{s.size ?? "—"}</span>{" "}
                                        <span className="text-xs text-muted">{s.sku}</span>
                                      </td>
                                      <td className="py-1 text-right tabular-nums">{qty(s.soldQty)}</td>
                                      <td className="py-1 text-right tabular-nums">{qty(s.returnedQty)}</td>
                                      <td className={`py-1 text-right tabular-nums ${rateTone(s.returnRate, m.returnRate)}`}>
                                        {pct(s.returnRate)}
                                      </td>
                                      <td className="py-1 text-right tabular-nums">{formatBRL(s.returnedValue)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              <p className="mt-1 ml-4 text-xs text-muted">Nos tamanhos, a cor compara com a média do próprio modelo.</p>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {data.unmatched.length > 0 && (
            <div className="flex flex-col gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 p-4 text-sm">
              <h2 className="font-medium text-amber-200">
                Devoluções sem venda no período ({formatBRL(data.unmatched.reduce((s, u) => s + u.returnedValue, 0))})
              </h2>
              <p className="text-xs text-amber-100/80">
                O código do produto na nota de devolução não aparece em nenhuma venda do período — venda mais antiga, ou
                nota emitida com código diferente do SKU. Entram no total devolvido, mas não na taxa dos modelos.
              </p>
              <ul className="text-xs text-amber-100">
                {data.unmatched.slice(0, 10).map((u) => (
                  <li key={u.code}>
                    {u.code} — {u.description}: {qty(u.returnedQty)} peça(s), {formatBRL(u.returnedValue)}
                  </li>
                ))}
                {data.unmatched.length > 10 && <li>e mais {data.unmatched.length - 10}.</li>}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
