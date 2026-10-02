"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatBRL } from "@/lib/format";
import {
  breakdownAt,
  currentBreakdown,
  ML_FREE_SHIPPING_THRESHOLD,
  priceForMargin,
  type ModelEconomics,
  type PriceAssumptions,
  type UnitBreakdown,
} from "@/domain/priceSimulator";

type PieceCost = { tecidoCost: number; costuraCost: number; aviamentosCost: number };

type ModelSku = {
  sku: string;
  cost: PieceCost | null;
  quantity: number;
  grossRevenue: number;
  beforeProductionCost: number;
  adSpend?: number;
};

type ProductModel = {
  key: string;
  label: string;
  name: string;
  skus: ModelSku[];
  referenceCost: PieceCost | null;
  costStatus: "igual" | "diferente" | "parcial" | "sem";
};

type Row = {
  key: string;
  label: string;
  name: string;
  economics: ModelEconomics;
  partialCost: boolean;
};

type Settings = { target: string; taxToday: string; tax2027: string; commission: string; includeAds: boolean };

const DEFAULT_SETTINGS: Settings = { target: "18", taxToday: "14", tax2027: "14", commission: "14", includeAds: true };
const STORAGE_KEY = "simulador-de-preco:premissas";

const total = (c: PieceCost | null) => (c ? c.tecidoCost + c.costuraCost + c.aviamentosCost : 0);
const pct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")}%`;
const toFraction = (v: string) => (Number(v.replace(",", ".")) || 0) / 100;

/** Junta os tamanhos vendidos de um modelo; tamanho vendido sem custo usa o custo de referência do modelo. */
function toRow(m: ProductModel, days: number): Row | null {
  const sold = m.skus.filter((s) => s.quantity > 0);
  if (sold.length === 0 || !m.referenceCost) return null;
  const units = sold.reduce((sum, s) => sum + s.quantity, 0);
  const costOf = (s: ModelSku) => (s.cost && total(s.cost) > 0 ? total(s.cost) : total(m.referenceCost));
  const perMonth = 30 / days;
  return {
    key: m.key,
    label: m.label,
    name: m.name,
    partialCost: sold.some((s) => !s.cost || total(s.cost) <= 0),
    economics: {
      units: units * perMonth,
      grossRevenue: sold.reduce((sum, s) => sum + s.grossRevenue, 0) * perMonth,
      beforeProductionCost: sold.reduce((sum, s) => sum + s.beforeProductionCost, 0) * perMonth,
      adSpend: sold.reduce((sum, s) => sum + (s.adSpend ?? 0), 0) * perMonth,
      unitCost: sold.reduce((sum, s) => sum + costOf(s) * s.quantity, 0) / units,
    },
  };
}

function marginTone(v: number, target: number) {
  if (v < 0.05) return "text-red-400";
  if (v < target) return "text-amber-300";
  return "text-emerald-400";
}

function Increase({ from, to }: { from: number; to: number | null }) {
  if (to === null) return <span className="text-red-400">não chega</span>;
  const change = to / from - 1;
  return (
    <span className="tabular-nums">
      {formatBRL(to)}{" "}
      <span className={`text-xs ${change > 0.15 ? "text-red-400" : change > 0 ? "text-amber-300" : "text-emerald-400"}`}>
        {change > 0 ? "+" : ""}
        {pct(change)}
      </span>
      {from < ML_FREE_SHIPPING_THRESHOLD && to >= ML_FREE_SHIPPING_THRESHOLD && (
        <span className="ml-1 text-xs text-amber-300" title="Cruza a faixa de frete grátis do ML: o custo de frete muda">
          ⚠ R$ 79
        </span>
      )}
    </span>
  );
}

function BreakdownTable({ today, future, units }: { today: UnitBreakdown; future: UnitBreakdown; units: number }) {
  const lines: [string, keyof UnitBreakdown][] = [
    ["Preço", "price"],
    ["(−) Imposto", "tax"],
    ["(−) Comissão do marketplace", "commission"],
    ["(−) Tarifa fixa, frete e Flex", "fixedPerUnit"],
    ["(−) Ads", "ads"],
    ["(−) Custo de produção", "productionCost"],
  ];
  return (
    <table className="w-full max-w-xl text-sm">
      <thead>
        <tr className="border-b border-border text-muted">
          <th className="py-1.5 text-left font-medium">Por peça</th>
          <th className="py-1.5 text-right font-medium">Imposto de hoje</th>
          <th className="py-1.5 text-right font-medium">Imposto de 2027</th>
        </tr>
      </thead>
      <tbody>
        {lines.map(([label, key]) => (
          <tr key={key} className="border-b border-border/50">
            <td className="py-1.5 text-muted">{label}</td>
            <td className="py-1.5 text-right tabular-nums">{formatBRL(today[key])}</td>
            <td className="py-1.5 text-right tabular-nums">{formatBRL(future[key])}</td>
          </tr>
        ))}
        <tr className="border-b border-border/50 font-medium">
          <td className="py-1.5 text-foreground">Sobra por peça</td>
          <td className="py-1.5 text-right tabular-nums">{formatBRL(today.contribution)} ({pct(today.marginPercent)})</td>
          <td className="py-1.5 text-right tabular-nums">{formatBRL(future.contribution)} ({pct(future.marginPercent)})</td>
        </tr>
        <tr>
          <td className="py-1.5 text-muted">Sobra no mês (mesmo volume, {Math.round(units)} peças)</td>
          <td className="py-1.5 text-right tabular-nums">{formatBRL(today.contribution * units)}</td>
          <td className="py-1.5 text-right tabular-nums">{formatBRL(future.contribution * units)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function Tester({ row, assumptions, target, tax2027 }: { row: Row; assumptions: PriceAssumptions; target: number; tax2027: number }) {
  const current = currentBreakdown(row.economics, assumptions);
  const suggested = priceForMargin(row.economics, assumptions, target, tax2027);
  const [price, setPrice] = useState((suggested ?? current.price).toFixed(2));
  const p = Number(price.replace(",", ".")) || 0;
  const today = breakdownAt(row.economics, assumptions, p);
  const future = breakdownAt(row.economics, assumptions, p, tax2027);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-gold/40 bg-background/60 p-4">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted">
          Testar um preço (R$)
          <input
            type="text"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-32 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          />
        </label>
        <span className="text-xs text-muted">
          Hoje: {formatBRL(current.price)} com {pct(current.marginPercent)} de margem e {formatBRL(current.contribution * row.economics.units)}{" "}
          de sobra no mês.
        </span>
      </div>
      {p > 0 && <BreakdownTable today={today} future={future} units={row.economics.units} />}
      <p className="max-w-prose text-xs text-muted">
        &quot;Sobra no mês&quot; supõe que você continue vendendo a mesma quantidade — na prática, aumento de preço costuma
        tirar um pouco de volume. Suba aos poucos e acompanhe as vendas.
        {current.price < ML_FREE_SHIPPING_THRESHOLD && p >= ML_FREE_SHIPPING_THRESHOLD && (
          <span className="text-amber-300">
            {" "}
            Esse preço cruza R$ 79: o frete grátis passa a ser seu e a parte fixa muda — confira na calculadora de custos do
            Mercado Livre antes.
          </span>
        )}
      </p>
    </div>
  );
}

export default function SimuladorDePrecoPage() {
  const [data, setData] = useState<{ days: number; models: ProductModel[] } | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [onlyBelow, setOnlyBelow] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/products/models")
      .then((res) => res.json())
      .then((json) => {
        // Premissas salvas só depois de montar a tela (o servidor não tem localStorage).
        try {
          const saved = window.localStorage.getItem(STORAGE_KEY);
          if (saved) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
        } catch {
          // sem armazenamento local: fica com o padrão
        }
        setSettingsLoaded(true);
        setData(json);
      });
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // sem armazenamento local: as premissas só não ficam salvas
    }
  }, [settings, settingsLoaded]);

  const target = toFraction(settings.target);
  const tax2027 = toFraction(settings.tax2027);
  const assumptions: PriceAssumptions = {
    taxRate: toFraction(settings.taxToday),
    commissionRate: toFraction(settings.commission),
    includeAds: settings.includeAds,
  };

  const rows = useMemo(
    () =>
      data
        ? data.models
            .map((m) => toRow(m, data.days))
            .filter((r): r is Row => r !== null)
            .sort((a, b) => b.economics.grossRevenue - a.economics.grossRevenue)
        : [],
    [data],
  );
  const withoutCost = data ? data.models.filter((m) => !m.referenceCost && m.skus.some((s) => s.quantity > 0)).length : 0;

  const visible = rows.filter((r) => {
    if (onlyBelow && currentBreakdown(r.economics, assumptions).marginPercent >= target) return false;
    const q = search.trim().toUpperCase();
    return !q || r.label.toUpperCase().includes(q) || r.name.toUpperCase().includes(q);
  });

  const totals = rows.reduce(
    (acc, r) => {
      const b = currentBreakdown(r.economics, assumptions);
      return { revenue: acc.revenue + r.economics.grossRevenue, contribution: acc.contribution + b.contribution * r.economics.units };
    },
    { revenue: 0, contribution: 0 },
  );

  const set = (key: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setSettings((s) => ({ ...s, [key]: key === "includeAds" ? e.target.checked : e.target.value }));
  const inputClass =
    "w-24 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl text-foreground">Simulador de preço</h1>
        <p className="max-w-prose text-sm text-muted">
          Quanto cobrar em cada modelo pra chegar na margem que você quer, hoje e com o imposto de 2027. Parte das vendas
          reais dos últimos {data?.days ?? 90} dias (já com imposto, tarifa, frete e Flex do Mercado Turbo), do custo
          cadastrado em{" "}
          <Link href="/custo-por-modelo" className="text-gold hover:underline">
            Custo por modelo
          </Link>{" "}
          e do Ads do período.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-xs font-medium tracking-wide text-muted uppercase">Premissas</h2>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            Margem final desejada (%)
            <input value={settings.target} onChange={set("target")} inputMode="decimal" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            Imposto hoje (%)
            <input value={settings.taxToday} onChange={set("taxToday")} inputMode="decimal" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            Imposto em 2027 (%)
            <input value={settings.tax2027} onChange={set("tax2027")} inputMode="decimal" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            Comissão do marketplace (%)
            <input value={settings.commission} onChange={set("commission")} inputMode="decimal" className={inputClass} />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-foreground">
            <input type="checkbox" checked={settings.includeAds} onChange={set("includeAds")} />
            Descontar Ads
          </label>
        </div>
        <p className="max-w-prose text-xs text-muted">
          <strong className="text-foreground">Imposto hoje</strong> é o percentual configurado no Mercado Turbo (o que ele
          desconta de cada venda). <strong className="text-foreground">Imposto em 2027</strong>: troque pelo número que o
          contador passar para depois da saída do Simples. A <strong className="text-foreground">comissão</strong> é a parte
          da tarifa do marketplace que cresce com o preço; o resto (tarifa fixa, frete, Flex) o simulador tira das suas
          vendas reais. O preço médio inclui o frete pago pelo comprador quando há — use como referência e confira o preço
          final na calculadora do Mercado Livre.
        </p>
      </div>

      {data && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-surface p-4">
            <span className="text-xs font-medium tracking-wide text-muted uppercase">Receita por mês (modelos com custo)</span>
            <p className="font-serif text-2xl text-gold">{formatBRL(totals.revenue)}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <span className="text-xs font-medium tracking-wide text-muted uppercase">Margem final hoje</span>
            <p className={`font-serif text-2xl ${marginTone(totals.revenue > 0 ? totals.contribution / totals.revenue : 0, target)}`}>
              {totals.revenue > 0 ? pct(totals.contribution / totals.revenue) : "—"}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <span className="text-xs font-medium tracking-wide text-muted uppercase">Sobra por mês hoje</span>
            <p className="font-serif text-2xl text-foreground">{formatBRL(totals.contribution)}</p>
          </div>
        </div>
      )}

      {withoutCost > 0 && (
        <p className="text-xs text-amber-300">
          {withoutCost} modelo(s) vendidos ainda sem custo ficam de fora —{" "}
          <Link href="/custo-por-modelo" className="underline">
            cadastre em Custo por modelo
          </Link>
          .
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={onlyBelow} onChange={(e) => setOnlyBelow(e.target.checked)} />
          Só modelos abaixo da meta
        </label>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar modelo"
          className="w-56 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
        />
      </div>

      {!data ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted">Nenhum modelo neste filtro.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface p-4">
          <table className="w-full min-w-4xl text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 font-medium">Modelo</th>
                <th className="py-2 text-right font-medium">Peças/mês</th>
                <th className="py-2 text-right font-medium">Preço médio</th>
                <th className="py-2 text-right font-medium">Custo da peça</th>
                <th className="py-2 text-right font-medium">Margem hoje</th>
                <th className="py-2 pl-4 font-medium">Preço p/ {settings.target}% hoje</th>
                <th className="py-2 pl-4 font-medium">Preço p/ {settings.target}% em 2027</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const now = currentBreakdown(r.economics, assumptions);
                return (
                  <Fragment key={r.key}>
                    <tr className="border-b border-border/50 align-top">
                      <td className="py-2 pr-4">
                        <span className="font-medium text-foreground">{r.label}</span>
                        <span className="block max-w-xs truncate text-xs text-muted" title={r.name}>
                          {r.name}
                        </span>
                        {r.partialCost && <span className="text-xs text-amber-300">tamanho sem custo: usei o do modelo</span>}
                      </td>
                      <td className="py-2 text-right tabular-nums">{Math.round(r.economics.units)}</td>
                      <td className="py-2 text-right tabular-nums">{formatBRL(now.price)}</td>
                      <td className="py-2 text-right tabular-nums">{formatBRL(r.economics.unitCost)}</td>
                      <td className={`py-2 text-right tabular-nums font-medium ${marginTone(now.marginPercent, target)}`}>
                        {pct(now.marginPercent)}
                      </td>
                      <td className="py-2 pl-4">
                        <Increase from={now.price} to={priceForMargin(r.economics, assumptions, target)} />
                      </td>
                      <td className="py-2 pl-4">
                        <Increase from={now.price} to={priceForMargin(r.economics, assumptions, target, tax2027)} />
                      </td>
                      <td className="py-2 pl-4 text-right">
                        <button
                          onClick={() => setOpen(open === r.key ? null : r.key)}
                          className="rounded border border-gold px-3 py-1 text-xs text-gold transition hover:bg-gold hover:text-background"
                        >
                          {open === r.key ? "Fechar" : "Testar preço"}
                        </button>
                      </td>
                    </tr>
                    {open === r.key && (
                      <tr>
                        <td colSpan={8} className="py-3">
                          <Tester row={r} assumptions={assumptions} target={target} tax2027={tax2027} />
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
    </div>
  );
}
