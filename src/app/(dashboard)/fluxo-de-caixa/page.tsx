"use client";

import { useEffect, useState, type FormEvent } from "react";
import { formatBRL } from "@/lib/format";
import { SaldoPorConta, type ContaSaldo } from "@/components/SaldoPorConta";
import { PrintButton } from "@/components/PrintButton";

type Movement = {
  date: string;
  amount: number;
  label: string;
  cardName?: string | null;
  categoryName?: string | null;
  planned?: boolean;
};
type CashFlowDay = {
  date: string;
  inflow: number;
  outflow: number;
  netChange: number;
  runningBalance: number;
  movements: Movement[];
};

type RealizedToday = {
  inflow: number;
  outflow: number;
  movements: Movement[];
};

type MaterialSplit = {
  tecidoPercent: number;
  aviamentoPercent: number;
  coveragePercent: number | null;
  lowCoverage: boolean;
} | null;

type WeeklyBucket = {
  startDate: string;
  endDate: string;
  inflow: number;
  outflow: number;
  netChange: number;
  endingBalance: number;
  days: number;
  estimatedAdditionalRevenue: number;
};

/** Fixado na carga do modulo: ler a data durante o render torna o componente impuro. */
const AGORA = Date.now();

type PlannedPurchase = {
  id: string;
  kind: string;
  label: string;
  amount: number;
  dueDate: string;
  installments: number;
  parentId: string | null;
};

type PurchaseSuggestion = {
  tecido: number;
  aviamentos: number;
  costuraPerTecido: number | null;
  coveragePercent: number | null;
  lowCoverage: boolean;
} | null;

type WithPlanned = {
  days: CashFlowDay[];
  endBalance: number;
  lowestDay: { date: string; balance: number };
  firstNegativeDay: CashFlowDay | null;
};

type CashFlowReport = {
  plannedPurchases: PlannedPurchase[];
  withPlanned: WithPlanned;
  purchaseSuggestion: PurchaseSuggestion;
  startingBalance: number;
  accounts: ContaSaldo[];
  days: CashFlowDay[];
  firstNegativeDay: CashFlowDay | null;
  mlOutsideWindow: number;
  realizedToday: RealizedToday;
  safeToSpend: number;
  safeToSpendWithML: number;
  mlTotal: number;
  totalPendingOutflows: number;
  materialSplit: MaterialSplit;
  weeklyBreakdown: WeeklyBucket[];
  dailyNetRevenuePace: number;
};

function MaterialSplitLine({ amount, split }: { amount: number; split: MaterialSplit }) {
  if (!split) return null;
  const tecido = amount * (split.tecidoPercent / 100);
  const aviamento = amount * (split.aviamentoPercent / 100);
  return (
    <p className="text-xs opacity-80">
      Sugestão: {formatBRL(tecido)} em tecido ({split.tecidoPercent.toFixed(0)}%) ·{" "}
      {formatBRL(aviamento)} em aviamento ({split.aviamentoPercent.toFixed(0)}%)
      {split.lowCoverage && split.coveragePercent !== null && (
        <> — baseado em {split.coveragePercent.toFixed(0)}% das vendas recentes com custo cadastrado</>
      )}
    </p>
  );
}

function WeeklyBreakdown({ buckets }: { buckets: WeeklyBucket[] }) {
  if (buckets.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
      <h2 className="font-serif text-lg text-foreground">Visão semanal</h2>
      <p className="text-xs text-muted">
        Cada linha é um bloco de dias corridos a partir de hoje — o saldo já é o mesmo calculado na
        curva acima, só agrupado. A estimativa de venda é o ritmo real dos últimos 30 dias
        (vendas ainda não registradas como lançamento) e nunca é somada ao saldo garantido.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="py-2 font-medium">Semana</th>
              <th className="py-2 font-medium">Entradas</th>
              <th className="py-2 font-medium">Saídas</th>
              <th className="py-2 font-medium">Saldo no fim da semana</th>
              <th className="py-2 font-medium">Estimativa de venda (não garantida)</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b, idx) => (
              <tr key={idx} className="border-b border-border/50">
                <td className="py-2 whitespace-nowrap">
                  {formatDate(b.startDate)} – {formatDate(b.endDate)}
                </td>
                <td className="py-2 text-emerald-400">{formatBRL(b.inflow)}</td>
                <td className="py-2 text-red-400">{formatBRL(b.outflow)}</td>
                <td
                  className={`py-2 font-medium ${b.endingBalance >= 0 ? "text-foreground" : "text-red-400"}`}
                >
                  {formatBRL(b.endingBalance)}
                </td>
                <td className="py-2 text-muted">≈ {formatBRL(b.estimatedAdditionalRevenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function formatDateLong(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "long",
  });
}

function BalanceChart({ days }: { days: CashFlowDay[] }) {
  const width = 760;
  const height = 180;
  const padTop = 16;
  const padBottom = 24;
  const padX = 8;

  const values = days.map((d) => d.runningBalance);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const range = max - min || 1;

  const n = values.length;
  const x = (i: number) => padX + (i / (n - 1 || 1)) * (width - padX * 2);
  const y = (v: number) => padTop + (1 - (v - min) / range) * (height - padTop - padBottom);
  const zeroY = y(0);

  const linePath = values.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");
  const hasNegative = values.some((v) => v < 0);

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
        {min < 0 && max > 0 && (
          <line
            x1={padX}
            y1={zeroY}
            x2={width - padX}
            y2={zeroY}
            stroke="#3a3a38"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        )}
        <path
          d={linePath}
          fill="none"
          stroke={hasNegative ? "#f87171" : "#D4AF37"}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {values.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={v < 0 ? 3 : 2} fill={v < 0 ? "#f87171" : "#D4AF37"}>
            <title>
              {formatDate(days[i].date)}: {formatBRL(v)}
            </title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-muted">
        <span>{formatDate(days[0].date)}</span>
        <span>{formatDate(days[days.length - 1].date)}</span>
      </div>
    </div>
  );
}

type DisplayItem =
  | { kind: "single"; movement: Movement }
  | { kind: "group"; label: string; amount: number; items: Movement[] };

/** Agrupa itens do mesmo dia que vêm do mesmo cartão (compra parcelada ou
 * assinatura vinculada) numa linha só "Fatura {cartão}" — na vida real só
 * sai um débito da conta por fatura, não um por item. Sem cartão, agrupa
 * pela categoria (ex.: vários lançamentos de "Materiais de Consumo" no
 * mesmo dia viram uma linha só). Um grupo com um único item não se forma
 * (não ganha nada em virar "X (1)"). */
function groupMovements(movements: Movement[]): DisplayItem[] {
  const byCard = new Map<string, Movement[]>();
  const byCategory = new Map<string, Movement[]>();
  const singles: Movement[] = [];

  for (const m of movements) {
    if (m.cardName) {
      const list = byCard.get(m.cardName) ?? [];
      list.push(m);
      byCard.set(m.cardName, list);
    } else if (m.categoryName) {
      const list = byCategory.get(m.categoryName) ?? [];
      list.push(m);
      byCategory.set(m.categoryName, list);
    } else {
      singles.push(m);
    }
  }

  const items: DisplayItem[] = singles.map((movement) => ({ kind: "single", movement }));

  for (const [cardName, group] of byCard) {
    if (group.length === 1) {
      items.push({ kind: "single", movement: group[0] });
    } else {
      items.push({
        kind: "group",
        label: `Fatura ${cardName}`,
        amount: group.reduce((s, m) => s + m.amount, 0),
        items: group,
      });
    }
  }

  for (const [categoryName, group] of byCategory) {
    if (group.length === 1) {
      items.push({ kind: "single", movement: group[0] });
    } else {
      items.push({
        kind: "group",
        label: categoryName,
        amount: group.reduce((s, m) => s + m.amount, 0),
        items: group,
      });
    }
  }

  return items;
}

function MovementsList({ movements }: { movements: Movement[] }) {
  const [expanded, setExpanded] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const LIMIT = 8;

  const displayItems = groupMovements(movements);
  const visible = expanded ? displayItems : displayItems.slice(0, LIMIT);
  const hidden = displayItems.length - visible.length;

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <ul className="flex flex-col gap-0.5">
      {visible.map((item, idx) => {
        if (item.kind === "single") {
          const m = item.movement;
          return (
            <li
              key={idx}
              className={
                m.planned ? "text-amber-300 italic" : m.amount >= 0 ? "text-emerald-400" : "text-red-400"
              }
            >
              {m.label} ({m.amount >= 0 ? "+" : ""}
              {formatBRL(m.amount)})
            </li>
          );
        }
        const key = `${idx}-${item.label}`;
        const isOpen = expandedGroups.has(key);
        return (
          <li key={idx} className={item.amount >= 0 ? "text-emerald-400" : "text-red-400"}>
            <button
              type="button"
              onClick={() => toggleGroup(key)}
              className="text-left hover:underline"
              title="Ver itens desse grupo"
            >
              {isOpen ? "▾" : "▸"} {item.label} ({item.items.length} itens) ({item.amount >= 0 ? "+" : ""}
              {formatBRL(item.amount)})
            </button>
            {isOpen && (
              <ul className="ml-4 flex flex-col gap-0.5 text-muted">
                {item.items.map((m, i) => (
                  <li key={i}>
                    {m.label} ({m.amount >= 0 ? "+" : ""}
                    {formatBRL(m.amount)})
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
      {hidden > 0 && (
        <li>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-xs font-medium text-gold hover:text-gold-soft hover:underline"
          >
            + {hidden} outro(s)
          </button>
        </li>
      )}
    </ul>
  );
}

function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const inputClass =
  "rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none";

function PlannedPurchasesPanel({
  report,
  includePlanned,
  setIncludePlanned,
  periodLabel,
  onChanged,
}: {
  report: CashFlowReport;
  includePlanned: boolean;
  setIncludePlanned: (v: boolean) => void;
  periodLabel: string;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(report.plannedPurchases.length > 0);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [type, setType] = useState<"TECIDO" | "AVIAMENTOS" | "OUTRO">("TECIDO");
  const [supplierId, setSupplierId] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(() => addDaysISO(todayISO(), 7));
  const [installments, setInstallments] = useState("1");
  const [withCostura, setWithCostura] = useState(true);
  const [costuraAmount, setCosturaAmount] = useState("");
  const [costuraDate, setCosturaDate] = useState("");
  const [costuraTouched, setCosturaTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || suppliers.length > 0) return;
    fetch("/api/counterparties")
      .then((r) => r.json())
      .then((list: { id: string; name: string; isActive: boolean }[]) =>
        setSuppliers(list.filter((c) => c.isActive)),
      );
  }, [open, suppliers.length]);

  const ratio = report.purchaseSuggestion?.costuraPerTecido ?? null;
  const suggestedCostura =
    type === "TECIDO" && ratio !== null && Number(amount) > 0 ? (Number(amount) * ratio).toFixed(2) : "";
  const costuraValue = costuraTouched ? costuraAmount : suggestedCostura;
  const costuraDateValue = costuraDate || addDaysISO(dueDate, 15);
  const sendCostura = type === "TECIDO" && withCostura && Number(costuraValue) > 0;

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/planned-purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        counterpartyId: supplierId || undefined,
        amount,
        dueDate,
        installments,
        costuraAmount: sendCostura ? costuraValue : undefined,
        costuraDueDate: sendCostura ? costuraDateValue : undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(typeof body.error === "string" ? body.error : "Não foi possível salvar a compra planejada.");
      return;
    }
    setAmount("");
    setCosturaAmount("");
    setCosturaTouched(false);
    setCosturaDate("");
    setIncludePlanned(true);
    onChanged();
  }

  async function handleRemove(id: string) {
    await fetch(`/api/planned-purchases/${id}`, { method: "DELETE" });
    onChanged();
  }

  async function handleConfirm(item: PlannedPurchase) {
    const parcelas = item.installments > 1 ? ` em ${item.installments}x` : "";
    if (
      !confirm(
        `Confirmar a compra "${item.label}" de ${formatBRL(item.amount)}${parcelas}? Ela vira lançamento pendente real. A costura estimada continua só como estimativa.`,
      )
    )
      return;
    const res = await fetch(`/api/planned-purchases/${item.id}/confirm`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(typeof body.error === "string" ? body.error : "Não foi possível confirmar.");
      return;
    }
    onChanged();
  }

  const planned = report.plannedPurchases;
  const materials = planned.filter((p) => p.kind === "MATERIAL");
  const orphanCostura = planned.filter((p) => p.kind === "COSTURA" && !materials.some((m) => m.id === p.parentId));
  const realEnd = report.days[report.days.length - 1].runningBalance;
  const negative = report.withPlanned.firstNegativeDay;
  const sug = report.purchaseSuggestion;

  return (
    <div className="no-print flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <button type="button" onClick={() => setOpen(!open)} className="flex items-center justify-between text-left">
        <span className="font-serif text-lg text-foreground">
          {open ? "▾" : "▸"} Planejar compra
          {planned.length > 0 && <span className="ml-2 text-xs text-amber-300">{materials.length} planejada(s)</span>}
        </span>
        <span className="text-xs text-muted">simulação — não vira lançamento até você confirmar</span>
      </button>

      {open && (
        <>
          {sug && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
              <span>
                Reposição de 30 dias de vendas: tecido {formatBRL(sug.tecido)} · aviamentos {formatBRL(sug.aviamentos)}
                {sug.lowCoverage && sug.coveragePercent !== null && (
                  <> (baseado em {sug.coveragePercent.toFixed(0)}% das vendas com custo cadastrado)</>
                )}
              </span>
              <button
                type="button"
                onClick={() => {
                  setType("TECIDO");
                  setAmount(sug.tecido.toFixed(2));
                  setCosturaTouched(false);
                }}
                className="text-xs font-medium text-gold hover:underline"
              >
                usar tecido
              </button>
              <button
                type="button"
                onClick={() => {
                  setType("AVIAMENTOS");
                  setAmount(sug.aviamentos.toFixed(2));
                }}
                className="text-xs font-medium text-gold hover:underline"
              >
                usar aviamentos
              </button>
            </div>
          )}

          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted">Tipo</label>
              <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className={inputClass}>
                <option value="TECIDO">Tecido</option>
                <option value="AVIAMENTOS">Aviamentos</option>
                <option value="OUTRO">Outro</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted">Fornecedor (opcional)</label>
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={`w-48 ${inputClass}`}>
                <option value="">—</option>
                {suppliers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted">Valor total (R$)</label>
              <input
                required
                type="number"
                step="0.01"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`w-32 ${inputClass}`}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted">Pagar em</label>
              <input required type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted">Parcelas</label>
              <input
                type="number"
                min={1}
                max={12}
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
                className={`w-20 ${inputClass}`}
              />
            </div>
            {type === "TECIDO" && (
              <div className="flex flex-wrap items-end gap-3 rounded border border-border/60 px-3 py-2">
                <label className="flex items-center gap-2 pb-1.5 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={withCostura}
                    onChange={(e) => setWithCostura(e.target.checked)}
                    className="accent-gold"
                  />
                  Estimar costura
                </label>
                {withCostura && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-muted">Costura (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        min={0}
                        value={costuraValue}
                        onChange={(e) => {
                          setCosturaAmount(e.target.value);
                          setCosturaTouched(true);
                        }}
                        className={`w-28 ${inputClass}`}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-muted">Pagar em (15 dias depois)</label>
                      <input
                        type="date"
                        value={costuraDateValue}
                        onChange={(e) => setCosturaDate(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </>
                )}
              </div>
            )}
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-gold px-4 py-1.5 text-sm font-medium text-black transition hover:bg-gold-soft disabled:opacity-50"
            >
              {saving ? "Salvando..." : "Planejar"}
            </button>
          </form>
          {type === "TECIDO" && withCostura && ratio === null && (
            <p className="text-xs text-muted">
              Sem vendas recentes com custo de tecido cadastrado, então não consigo estimar a costura sozinho — preencha o valor.
            </p>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}

          {planned.length > 0 && (
            <>
              <ul className="flex flex-col gap-1.5 text-sm">
                {materials.map((m) => {
                  const child = planned.find((p) => p.parentId === m.id);
                  return (
                    <li key={m.id} className="flex flex-col gap-0.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-amber-300">
                        <span>
                          {m.label} — {formatBRL(m.amount)}
                          {m.installments > 1 ? ` em ${m.installments}x` : ""} · a partir de {formatDate(m.dueDate)}
                        </span>
                        <span className="flex gap-3 text-xs">
                          <button type="button" onClick={() => handleConfirm(m)} className="font-medium text-emerald-400 hover:underline">
                            Confirmar
                          </button>
                          <button type="button" onClick={() => handleRemove(m.id)} className="font-medium text-red-400 hover:underline">
                            Remover
                          </button>
                        </span>
                      </div>
                      {child && (
                        <div className="ml-4 flex flex-wrap items-center justify-between gap-2 text-amber-300/80">
                          <span>
                            └ {child.label} — {formatBRL(child.amount)} · {formatDate(child.dueDate)}
                          </span>
                          <button type="button" onClick={() => handleRemove(child.id)} className="text-xs font-medium text-red-400 hover:underline">
                            Remover
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
                {orphanCostura.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-amber-300/80">
                    <span>
                      {c.label} (compra já confirmada) — {formatBRL(c.amount)} · {formatDate(c.dueDate)}
                    </span>
                    <button type="button" onClick={() => handleRemove(c.id)} className="text-xs font-medium text-red-400 hover:underline">
                      Remover
                    </button>
                  </li>
                ))}
              </ul>

              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={includePlanned}
                  onChange={(e) => setIncludePlanned(e.target.checked)}
                  className="accent-gold"
                />
                Incluir no gráfico e nos movimentos
              </label>

              <div className="rounded border border-border/60 p-3 text-sm">
                <p className="text-foreground">
                  Saldo {periodLabel}: <span className="text-muted">{formatBRL(realEnd)}</span> →{" "}
                  <span className={report.withPlanned.endBalance >= 0 ? "text-emerald-400" : "text-red-400"}>
                    {formatBRL(report.withPlanned.endBalance)}
                  </span>{" "}
                  <span className="text-muted">(com as compras planejadas)</span>
                </p>
                <p className="text-muted">
                  Menor saldo no período: {formatBRL(report.withPlanned.lowestDay.balance)} em{" "}
                  {formatDate(report.withPlanned.lowestDay.date)}
                </p>
                {negative ? (
                  <p className="text-red-400">
                    ⚠ Não cabe: o saldo fica negativo em {formatDate(negative.date)} ({formatBRL(negative.runningBalance)}).
                  </p>
                ) : (
                  <p className="text-emerald-400">✔ Cabe: o saldo não fica negativo em nenhum dia do período.</p>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

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

type Range = 30 | 60 | 90 | "month";

export default function CashFlowPage() {
  const [range, setRange] = useState<Range>(30);
  const [report, setReport] = useState<CashFlowReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [includePlanned, setIncludePlanned] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setLoading(true);
    const query = range === "month" ? "range=month" : `days=${range}`;
    fetch(`/api/cash-flow?${query}`)
      .then((res) => res.json())
      .then((data) => {
        setReport(data);
        setLoading(false);
      });
  }, [range, reloadKey]);

  // Frase usada nos textos ("as contas pendentes ...") — no modo "mês
  // vigente" o período tem um nome fixo em vez de "X dias".
  const periodPhrase = range === "month" ? "até o fim do mês" : `nos próximos ${range} dias`;
  const periodLabel = range === "month" ? "até o fim do mês" : `em ${range} dias`;

  const activeDays =
    report && includePlanned && report.plannedPurchases.length > 0 ? report.withPlanned.days : report?.days;
  const daysWithMovement = activeDays?.filter((d) => d.movements.length > 0) ?? [];
  const lowestDay = activeDays?.reduce(
    (min, d) => (d.runningBalance < min.runningBalance ? d : min),
    activeDays[0],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-foreground">Fluxo de Caixa</h1>
          <p className="no-print text-sm text-muted">
            Projeção do saldo dia a dia, somando o saldo atual das contas com as contas a pagar e a
            receber ainda pendentes (pelas datas de vencimento). Vencidos entram a partir de hoje.
          </p>
          <p className="hidden text-sm text-muted print:block">Projeção {periodLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="no-print flex gap-1 rounded-lg border border-border bg-surface p-1">
            {([30, 60, 90] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setRange(d)}
                className={
                  d === range
                    ? "rounded bg-gold px-3 py-1.5 text-sm font-medium text-black"
                    : "rounded px-3 py-1.5 text-sm font-medium text-muted transition hover:text-foreground"
                }
              >
                {d} dias
              </button>
            ))}
            <button
              type="button"
              onClick={() => setRange("month")}
              className={
                range === "month"
                  ? "rounded bg-gold px-3 py-1.5 text-sm font-medium text-black"
                  : "rounded px-3 py-1.5 text-sm font-medium text-muted transition hover:text-foreground"
              }
            >
              Mês vigente
            </button>
          </div>
          <PrintButton />
        </div>
      </div>

      {loading || !report ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : (
        <>
          {report.firstNegativeDay && (
            <div className="rounded-lg border border-red-400/40 bg-red-400/10 p-4 text-sm text-red-400">
              <span className="mr-1.5 text-xs font-medium tracking-wide uppercase">Alerta</span>
              Seu saldo projetado fica negativo em{" "}
              <span className="font-medium">{formatDateLong(report.firstNegativeDay.date)}</span>,
              chegando a {formatBRL(report.firstNegativeDay.runningBalance)} — vai faltar dinheiro
              pra cobrir o que vence até lá, a não ser que entre alguma receita não prevista.
            </div>
          )}

          <div className={`grid grid-cols-1 gap-4 ${report.mlTotal > 0 ? "md:grid-cols-2" : ""}`}>
            {report.safeToSpend > 0 ? (
              <div className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 p-4">
                <span className="text-xs font-medium tracking-wide text-emerald-400 uppercase">
                  Compras
                </span>
                <p className="font-serif text-2xl text-emerald-400">
                  Pode gastar até {formatBRL(report.safeToSpend)}
                </p>
                <p className="text-sm text-emerald-400/80">
                  {report.totalPendingOutflows > 0 ? (
                    <>
                      Já descontando {formatBRL(report.totalPendingOutflows)} em contas pendentes
                      (inclusive custos fixos) que vencem {periodPhrase} — sem contar com
                      nenhuma entrada futura, nem confirmada.
                    </>
                  ) : (
                    "Não há contas pendentes nesse período descontando esse valor."
                  )}
                </p>
                <MaterialSplitLine amount={report.safeToSpend} split={report.materialSplit} />
              </div>
            ) : (
              !report.firstNegativeDay && (
                <div className="rounded-lg border border-red-400/40 bg-red-400/10 p-4 text-sm text-red-400">
                  <span className="mr-1.5 text-xs font-medium tracking-wide uppercase">Compras</span>
                  Não sobra nada pra gastar agora — as contas pendentes {periodPhrase}
                  ({formatBRL(report.totalPendingOutflows)}) já consomem todo o saldo atual.
                </div>
              )
            )}

            {report.mlTotal > 0 && (
              <div className="rounded-lg border border-sky-400/40 bg-sky-400/10 p-4">
                <span className="text-xs font-medium tracking-wide text-sky-400 uppercase">
                  Compras, contando com o Mercado Livre
                </span>
                <p className="font-serif text-2xl text-sky-400">
                  Pode gastar até {formatBRL(report.safeToSpendWithML)}
                </p>
                <p className="text-sm text-sky-400/80">
                  Mesma conta de "Compras", somando também {formatBRL(report.mlTotal)} que ainda vai
                  liberar no Mercado Livre, de todas as vendas em aberto — só use se confia que esse
                  valor vai mesmo cair na conta.
                </p>
                <MaterialSplitLine amount={report.safeToSpendWithML} split={report.materialSplit} />
              </div>
            )}
          </div>

          <PlannedPurchasesPanel
            report={report}
            includePlanned={includePlanned}
            setIncludePlanned={setIncludePlanned}
            periodLabel={periodLabel}
            onChanged={() => setReloadKey((k) => k + 1)}
          />

          {report.mlOutsideWindow > 0 && (
            <p className="text-xs text-muted">
              Além do que já está na projeção abaixo, tem mais {formatBRL(report.mlOutsideWindow)} do
              Mercado Livre por vir — ou ainda sem data (depende da entrega), ou com repasse previsto
              depois do período mostrado aqui.
            </p>
          )}

          {report.realizedToday.movements.length > 0 && (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-lg text-foreground">Realizado hoje</h2>
                <div className="flex gap-4 text-sm">
                  {report.realizedToday.inflow > 0 && (
                    <span className="text-emerald-400">+{formatBRL(report.realizedToday.inflow)}</span>
                  )}
                  {report.realizedToday.outflow > 0 && (
                    <span className="text-red-400">-{formatBRL(report.realizedToday.outflow)}</span>
                  )}
                </div>
              </div>
              <MovementsList movements={report.realizedToday.movements} />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Saldo atual" value={formatBRL(report.startingBalance)} />
            <StatCard
              label={`Saldo projetado ${periodLabel}`}
              value={formatBRL(activeDays![activeDays!.length - 1].runningBalance)}
              tone={activeDays![activeDays!.length - 1].runningBalance >= 0 ? "positive" : "negative"}
            />
            <StatCard
              label="Menor saldo no período"
              value={lowestDay ? formatBRL(lowestDay.runningBalance) : "—"}
              tone={lowestDay && lowestDay.runningBalance < 0 ? "negative" : "default"}
            />
          </div>

          <SaldoPorConta
            contas={report.accounts}
            hoje={AGORA}
            titulo="Saldo atual, por conta"
          />

          <BalanceChart days={activeDays!} />

          <WeeklyBreakdown buckets={report.weeklyBreakdown} />

          <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
            <h2 className="font-serif text-lg text-foreground">Movimentos previstos</h2>
            {daysWithMovement.length === 0 ? (
              <p className="text-sm text-muted">Nenhum lançamento pendente nesse período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted">
                      <th className="py-2 font-medium">Data</th>
                      <th className="py-2 font-medium">Movimentos</th>
                      <th className="py-2 font-medium">Entradas</th>
                      <th className="py-2 font-medium">Saídas</th>
                      <th className="py-2 font-medium">Saldo do dia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daysWithMovement.map((d) => (
                      <tr key={d.date} className="border-b border-border/50 align-top">
                        <td className="py-2 whitespace-nowrap">{formatDate(d.date)}</td>
                        <td className="py-2">
                          <MovementsList movements={d.movements} />
                        </td>
                        <td className="py-2 text-emerald-400">
                          {d.inflow > 0 ? formatBRL(d.inflow) : "—"}
                        </td>
                        <td className="py-2 text-red-400">
                          {d.outflow > 0 ? formatBRL(d.outflow) : "—"}
                        </td>
                        <td
                          className={`py-2 font-medium ${
                            d.runningBalance >= 0 ? "text-foreground" : "text-red-400"
                          }`}
                        >
                          {formatBRL(d.runningBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
