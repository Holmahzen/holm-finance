"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatBRL } from "@/lib/format";

type ChannelProduct = {
  sku: string;
  name: string;
  quantity: number;
  revenue: number;
  hasCost: boolean;
  contribution: number;
  marginPercent: number | null;
};

type Channel = {
  key: "mercadoLivre" | "shopee" | "direta";
  label: string;
  source: string;
  revenue: number;
  quantity: number;
  costedRevenue: number;
  tax: number;
  marketplaceFees: number;
  productionCost: number;
  ads: number;
  fullCost: number;
  contribution: number;
  marginPercent: number | null;
  costCoverage: number;
  products: ChannelProduct[];
};

type Report = {
  from: string;
  to: string;
  months: number;
  taxRate: number;
  taxRateSource: string;
  channels: Channel[];
  total: { revenue: number; contribution: number; marginPercent: number | null };
};

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5)) - 1]}/${m.slice(2, 4)}`;
const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1).replace(".", ",")}%`);

function marginTone(v: number | null) {
  if (v === null) return "text-muted";
  if (v < 0.1) return "text-red-400";
  if (v < 0.18) return "text-amber-300";
  return "text-emerald-400";
}

function ChannelCard({ channel, share }: { channel: Channel; share: number }) {
  const [showProducts, setShowProducts] = useState(false);
  const lines: [string, number][] = [
    ["Receita", channel.revenue],
    ["(−) Imposto", -channel.tax],
    ["(−) Tarifas, frete e Flex do marketplace", -channel.marketplaceFees],
    ["(−) Custo de produção", -channel.productionCost],
    ["(−) Ads", -channel.ads],
    ["(−) Full", -channel.fullCost],
  ];
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-serif text-xl text-foreground">{channel.label}</h2>
          <p className="text-xs text-muted">{channel.source}</p>
        </div>
        <div className="text-right">
          <p className={`font-serif text-3xl ${marginTone(channel.marginPercent)}`}>{pct(channel.marginPercent)}</p>
          <p className="text-xs text-muted">margem de contribuição</p>
        </div>
      </div>

      {channel.revenue === 0 ? (
        <p className="text-sm text-muted">Sem vendas deste canal no período.</p>
      ) : (
        <>
          <table className="w-full text-sm">
            <tbody>
              {lines
                .filter(([, v], i) => i === 0 || Math.abs(v) >= 0.005)
                .map(([label, value]) => (
                  <tr key={label} className="border-b border-border/40">
                    <td className="py-1 text-muted">{label}</td>
                    <td className="py-1 text-right tabular-nums">{formatBRL(value)}</td>
                  </tr>
                ))}
              <tr className="font-medium">
                <td className="py-1 text-foreground">Sobra (contribuição)</td>
                <td className={`py-1 text-right tabular-nums ${channel.contribution >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {formatBRL(channel.contribution)}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-muted">
            {pct(share)} da receita da empresa · {Math.round(channel.quantity).toLocaleString("pt-BR")} peças
            {channel.costCoverage < 0.98 && (
              <span className="text-amber-300">
                {" "}
                · só {pct(channel.costCoverage)} da receita tem custo cadastrado — a margem considera só essa parte (
                <Link href="/custo-por-modelo" className="underline">
                  cadastrar
                </Link>
                )
              </span>
            )}
          </p>
          <button onClick={() => setShowProducts((v) => !v)} className="self-start text-xs font-medium text-gold hover:underline">
            {showProducts ? "Esconder produtos" : `Ver produtos (${channel.products.length})`}
          </button>
          {showProducts && (
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-border text-xs text-muted">
                    <th className="py-1 text-left font-medium">Produto</th>
                    <th className="py-1 text-right font-medium">Peças</th>
                    <th className="py-1 text-right font-medium">Receita</th>
                    <th className="py-1 text-right font-medium">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {channel.products.map((p) => (
                    <tr key={p.sku} className="border-b border-border/30">
                      <td className="max-w-[16rem] truncate py-1" title={p.name}>
                        <span className="text-xs text-muted">{p.sku}</span> {p.name}
                      </td>
                      <td className="py-1 text-right tabular-nums">{Math.round(p.quantity)}</td>
                      <td className="py-1 text-right tabular-nums">{formatBRL(p.revenue)}</td>
                      <td className={`py-1 text-right tabular-nums ${p.hasCost ? marginTone(p.marginPercent) : "text-muted"}`}>
                        {p.hasCost ? pct(p.marginPercent) : "sem custo"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function MargemPorCanalPage() {
  const [months, setMonths] = useState(1);
  const [data, setData] = useState<Report | null>(null);

  useEffect(() => {
    fetch(`/api/channel-margin?months=${months}`)
      .then((res) => res.json())
      .then(setData);
  }, [months]);

  const loading = !data || data.months !== months;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl text-foreground">Margem por canal</h1>
        <p className="max-w-prose text-sm text-muted">
          Quanto sobra de cada real vendido no Mercado Livre, na Shopee e no atacado/venda direta, depois de imposto,
          tarifas, custo de produção e Ads — antes das despesas fixas. Devoluções ficam de fora (veja{" "}
          <Link href="/devolucoes" className="text-gold hover:underline">
            Devoluções
          </Link>
          ).
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
          </select>
        </label>
        {data && !loading && (
          <span className="pb-2 text-xs text-muted">
            {data.months === 1 ? monthLabel(data.to) : `${monthLabel(data.from)} a ${monthLabel(data.to)}`} · imposto de{" "}
            {pct(data.taxRate)} ({data.taxRateSource}) na Shopee e no atacado
          </span>
        )}
      </div>

      {loading || !data ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-surface p-4">
              <span className="text-xs font-medium tracking-wide text-muted uppercase">Receita dos canais</span>
              <p className="font-serif text-2xl text-foreground">{formatBRL(data.total.revenue)}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <span className="text-xs font-medium tracking-wide text-muted uppercase">Sobra (contribuição)</span>
              <p className="font-serif text-2xl text-gold">{formatBRL(data.total.contribution)}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-4">
              <span className="text-xs font-medium tracking-wide text-muted uppercase">Margem média</span>
              <p className={`font-serif text-2xl ${marginTone(data.total.marginPercent)}`}>{pct(data.total.marginPercent)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {data.channels.map((c) => (
              <ChannelCard key={c.key} channel={c} share={data.total.revenue > 0 ? c.revenue / data.total.revenue : 0} />
            ))}
          </div>

          <p className="max-w-prose text-xs text-muted">
            No Mercado Livre o imposto já vem descontado pelo Mercado Turbo (por isso a linha de imposto não aparece).
            No atacado, frete e comissão de vendedor não aparecem na nota fiscal: se você paga algum dos dois, a margem
            real é um pouco menor.
          </p>
        </>
      )}
    </div>
  );
}
