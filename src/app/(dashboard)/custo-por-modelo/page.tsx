"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { formatBRL } from "@/lib/format";

type PieceCost = { tecidoCost: number; costuraCost: number; aviamentosCost: number };

type ModelSku = {
  sku: string;
  name: string;
  productId: string | null;
  cost: PieceCost | null;
  quantity: number;
  grossRevenue: number;
  beforeProductionCost: number;
  size: string | null;
};

type ProductModel = {
  key: string;
  label: string;
  name: string;
  skus: ModelSku[];
  quantity: number;
  grossRevenue: number;
  costStatus: "igual" | "diferente" | "parcial" | "sem";
  referenceCost: PieceCost | null;
  kits: { sku: string; quantity: number; itemSku: string }[];
  marginPercent: number | null;
};

type Filter = "todos" | "pendentes" | "diferentes";

const STATUS_BADGE: Record<ProductModel["costStatus"], { label: string; className: string }> = {
  igual: { label: "custo cadastrado", className: "bg-emerald-500/15 text-emerald-400" },
  diferente: { label: "custo diferente entre tamanhos", className: "bg-amber-400/15 text-amber-300" },
  parcial: { label: "tamanho sem custo", className: "bg-red-400/15 text-red-400" },
  sem: { label: "sem custo", className: "bg-red-400/15 text-red-400" },
};

const total = (c: PieceCost | null) => (c ? c.tecidoCost + c.costuraCost + c.aviamentosCost : 0);
const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1).replace(".", ",")}%`);
const toNumber = (v: string) => Number(v.replace(",", ".")) || 0;
const sizeLabel = (s: ModelSku) => s.size ?? s.sku;

function marginTone(v: number | null) {
  if (v === null) return "text-muted";
  if (v < 0.1) return "text-red-400";
  if (v < 0.2) return "text-amber-300";
  return "text-emerald-400";
}

function Editor({ model, onSaved, onCancel }: { model: ProductModel; onSaved: (msg: string) => void; onCancel: () => void }) {
  const ref = model.referenceCost;
  const [tecido, setTecido] = useState(ref ? String(ref.tecidoCost) : "");
  const [costura, setCostura] = useState(ref ? String(ref.costuraCost) : "");
  const [aviamentos, setAviamentos] = useState(ref ? String(ref.aviamentosCost) : "");
  const [selected, setSelected] = useState<Set<string>>(new Set(model.skus.map((s) => s.sku)));
  const [includeKits, setIncludeKits] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cost: PieceCost = { tecidoCost: toNumber(tecido), costuraCost: toNumber(costura), aviamentosCost: toNumber(aviamentos) };
  const unitCost = total(cost);

  // Margem do período se esse custo valesse para os tamanhos marcados.
  const preview = useMemo(() => {
    const sold = model.skus.filter((s) => s.quantity > 0);
    const revenue = sold.reduce((sum, s) => sum + s.grossRevenue, 0);
    if (revenue <= 0) return null;
    const contribution = sold.reduce((sum, s) => {
      const c = selected.has(s.sku) ? unitCost : total(s.cost);
      return sum + s.beforeProductionCost - c * s.quantity;
    }, 0);
    return contribution / revenue;
  }, [model.skus, selected, unitCost]);

  const normalize = (t: string) => t.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const kits = model.kits.filter((k) =>
    model.skus.some((s) => selected.has(s.sku) && normalize(s.sku) === normalize(k.itemSku)),
  );

  function toggle(sku: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/products/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelKey: model.key, skus: [...selected], cost, includeKits }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(body.error ?? "Não foi possível salvar.");
      return;
    }
    const parts = [`${body.updated} atualizado(s)`];
    if (body.created > 0) parts.push(`${body.created} criado(s) em Produtos`);
    if (body.kits > 0) parts.push(`${body.kits} kit(s) recalculado(s)`);
    onSaved(`${model.label}: ${parts.join(", ")}.`);
  }

  const inputClass =
    "w-28 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none";

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-gold/40 bg-background/60 p-4">
      <div className="flex flex-wrap items-end gap-4">
        {(
          [
            ["Tecido", tecido, setTecido],
            ["Costura", costura, setCostura],
            ["Aviamentos", aviamentos, setAviamentos],
          ] as const
        ).map(([label, value, set]) => (
          <label key={label} className="flex flex-col gap-1 text-xs font-medium text-muted">
            {label} (R$/peça)
            <input type="text" inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} className={inputClass} />
          </label>
        ))}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Custo da peça</span>
          <span className="font-serif text-xl text-gold">{formatBRL(unitCost)}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted">Margem real com esse custo</span>
          <span className={`font-serif text-xl ${marginTone(preview)}`}>{pct(preview)}</span>
        </div>
      </div>
      <p className="text-xs text-muted">
        Se não souber separar, pode pôr o custo inteiro em um campo só — a divisão só importa pra planejar compra
        de tecido e aviamento.
      </p>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium tracking-wide text-muted uppercase">Aplicar nos tamanhos</span>
        <div className="flex flex-wrap gap-2">
          {model.skus.map((s) => (
            <label
              key={s.sku}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
                selected.has(s.sku) ? "border-gold/60 text-foreground" : "border-border text-muted"
              }`}
              title={s.sku}
            >
              <input type="checkbox" checked={selected.has(s.sku)} onChange={() => toggle(s.sku)} />
              <span className="font-medium">{sizeLabel(s)}</span>
              <span className="text-xs text-muted">{s.cost && total(s.cost) > 0 ? formatBRL(total(s.cost)) : "sem custo"}</span>
            </label>
          ))}
        </div>
        <p className="text-xs text-muted">Desmarque o tamanho que gasta mais tecido (ex.: EG) e salve ele depois, com o custo dele.</p>
      </div>

      {kits.length > 0 && (
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input type="checkbox" checked={includeKits} onChange={(e) => setIncludeKits(e.target.checked)} className="mt-1" />
          <span>
            Recalcular também os kits:{" "}
            {kits.map((k) => `${k.sku} (${k.quantity} × ${formatBRL(unitCost)} = ${formatBRL(unitCost * k.quantity)})`).join(" · ")}
          </span>
        </label>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-3">
        <button
          onClick={save}
          disabled={saving || selected.size === 0 || unitCost <= 0}
          className="rounded bg-gold px-4 py-1.5 text-sm font-medium text-black transition hover:bg-gold-soft disabled:opacity-50"
        >
          {saving ? "Salvando..." : `Salvar em ${selected.size} tamanho(s)`}
        </button>
        <button onClick={onCancel} className="rounded border border-border px-4 py-1.5 text-sm text-muted hover:text-foreground">
          Cancelar
        </button>
      </div>
    </div>
  );
}

export default function CustoPorModeloPage() {
  const [data, setData] = useState<{ days: number; models: ProductModel[] } | null>(null);
  const [filter, setFilter] = useState<Filter>("pendentes");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/products/models");
    setData(await res.json());
  }

  useEffect(() => {
    fetch("/api/products/models")
      .then((res) => res.json())
      .then(setData);
  }, []);

  const models = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toUpperCase();
    return data.models.filter((m) => {
      if (filter === "pendentes" && (m.costStatus === "igual" || m.costStatus === "diferente")) return false;
      if (filter === "diferentes" && m.costStatus !== "diferente") return false;
      if (!q) return true;
      return m.label.toUpperCase().includes(q) || m.key.includes(q.replace(/[^A-Z0-9]/g, "")) || m.name.toUpperCase().includes(q) || m.skus.some((s) => s.sku.toUpperCase().includes(q));
    });
  }, [data, filter, search]);

  const pendingCount = data?.models.filter((m) => m.costStatus === "sem" || m.costStatus === "parcial").length ?? 0;
  const pendingRevenue =
    data?.models.filter((m) => m.costStatus === "sem" || m.costStatus === "parcial").reduce((s, m) => s + m.grossRevenue, 0) ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl text-foreground">Custo por modelo</h1>
        <p className="max-w-prose text-sm text-muted">
          Cadastre o custo uma vez por modelo e ele vale para todos os tamanhos. Kits de quantidade (ex.: 5.TO1001)
          são recalculados a partir do item. Os valores vão para Produtos e passam a valer na DRE, na Lucratividade e
          no Ponto de Equilíbrio.
        </p>
      </div>

      {data && (
        <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-surface p-4">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            Mostrar
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as Filter)}
              className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            >
              <option value="pendentes">Sem custo ou com tamanho faltando ({pendingCount})</option>
              <option value="diferentes">Custo diferente entre tamanhos</option>
              <option value="todos">Todos os modelos ({data.models.length})</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            Buscar
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="SKU ou nome"
              className="w-56 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
            />
          </label>
          {pendingCount > 0 && (
            <p className="text-xs text-amber-300">
              {pendingCount} modelo(s) com tamanho sem custo venderam {formatBRL(pendingRevenue)} nos últimos {data.days} dias
              — a margem desses fica otimista até cadastrar.
            </p>
          )}
        </div>
      )}

      {message && <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300">{message}</p>}

      {!data ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : models.length === 0 ? (
        <p className="text-sm text-muted">Nenhum modelo neste filtro.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface p-4">
          <table className="w-full min-w-3xl text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 font-medium">Modelo</th>
                <th className="py-2 font-medium">Tamanhos</th>
                <th className="py-2 text-right font-medium">Vendas ({data.days} dias)</th>
                <th className="py-2 pl-4 font-medium">Custo da peça</th>
                <th className="py-2 text-right font-medium">Margem real</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <Fragment key={m.key}>
                  <tr className="border-b border-border/50 align-top">
                    <td className="py-2 pr-4">
                      <span className="font-medium text-foreground">{m.label}</span>
                      <span className="block max-w-xs truncate text-xs text-muted" title={m.name}>
                        {m.name}
                      </span>
                    </td>
                    <td className="py-2 text-xs text-muted">{m.skus.map(sizeLabel).join(" · ")}</td>
                    <td className="py-2 text-right tabular-nums text-foreground">
                      {formatBRL(m.grossRevenue)}
                      <span className="block text-xs text-muted">{m.quantity} peças</span>
                    </td>
                    <td className="py-2 pl-4">
                      <span className="tabular-nums text-foreground">{m.referenceCost ? formatBRL(total(m.referenceCost)) : "—"}</span>
                      <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[m.costStatus].className}`}>
                        {STATUS_BADGE[m.costStatus].label}
                      </span>
                    </td>
                    <td className={`py-2 text-right tabular-nums ${marginTone(m.marginPercent)}`}>{pct(m.marginPercent)}</td>
                    <td className="py-2 pl-4 text-right">
                      <button
                        onClick={() => {
                          setEditing(editing === m.key ? null : m.key);
                          setMessage(null);
                        }}
                        className="rounded border border-gold px-3 py-1 text-xs text-gold transition hover:bg-gold hover:text-background"
                      >
                        {editing === m.key ? "Fechar" : "Editar custo"}
                      </button>
                    </td>
                  </tr>
                  {editing === m.key && (
                    <tr>
                      <td colSpan={6} className="py-3">
                        <Editor
                          model={m}
                          onCancel={() => setEditing(null)}
                          onSaved={async (msg) => {
                            setEditing(null);
                            setMessage(msg);
                            await load();
                          }}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
