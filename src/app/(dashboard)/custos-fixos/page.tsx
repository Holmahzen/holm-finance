"use client";

import { Fragment, useEffect, useState, type FormEvent } from "react";
import { formatBRL } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";
import { computeFixedCostDueDates } from "@/domain/fixedCostSchedule";

type Option = { id: string; name: string };
type CategoryOption = Option & { parentId: string | null };
type CreditCardOption = { id: string; name: string; isActive: boolean };

type FixedCostFrequency = "MONTHLY" | "BIWEEKLY" | "WEEKLY";

type FixedCost = {
  id: string;
  type: "PAYABLE" | "RECEIVABLE";
  description: string;
  amount: string;
  frequency: FixedCostFrequency;
  dueDay: number | null;
  secondDueDay: number | null;
  weekday: number | null;
  isActive: boolean;
  laborProvisionEligible: boolean;
  categoryId: string | null;
  counterpartyId: string | null;
  creditCardId: string | null;
  category: { name: string } | null;
  counterparty: { name: string } | null;
  creditCard: { id: string; name: string } | null;
};

function monthlyAmount(fc: FixedCost, year: number, month: number): number {
  const occurrences = computeFixedCostDueDates(
    { frequency: fc.frequency, dueDay: fc.dueDay, secondDueDay: fc.secondDueDay, weekday: fc.weekday },
    year,
    month,
  );
  return occurrences.length * Number(fc.amount);
}

const WEEKDAY_LABELS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

function scheduleSortKey(fc: FixedCost): number {
  if (fc.frequency === "BIWEEKLY") {
    return Math.min(fc.dueDay ?? 32, fc.secondDueDay ?? 32);
  }
  if (fc.frequency === "WEEKLY") {
    return 32 + (fc.weekday ?? 0);
  }
  return fc.dueDay ?? 32;
}

function scheduleLabel(fc: FixedCost): string {
  if (fc.frequency === "BIWEEKLY") {
    return `Dias ${fc.dueDay ?? "?"} e ${fc.secondDueDay ?? "?"} (quinzenal)`;
  }
  if (fc.frequency === "WEEKLY") {
    return `Toda ${WEEKDAY_LABELS[fc.weekday ?? 0]} (semanal)`;
  }
  return `Dia ${fc.dueDay ?? "?"}`;
}

type GenerateResult = {
  total: number;
  generated: number;
  skipped: number;
  byMonth?: { year: number; month: number; generated: number; skipped: number }[];
};

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const now = new Date();

export default function FixedCostsPage() {
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [counterparties, setCounterparties] = useState<Option[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCardOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [cardFilter, setCardFilter] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState<"PAYABLE" | "RECEIVABLE">("PAYABLE");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<FixedCostFrequency>("MONTHLY");
  const [dueDay, setDueDay] = useState("5");
  const [secondDueDay, setSecondDueDay] = useState("20");
  const [weekday, setWeekday] = useState("5");
  const [categoryId, setCategoryId] = useState("");
  const [counterpartyId, setCounterpartyId] = useState("");
  const [creditCardId, setCreditCardId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [genYear, setGenYear] = useState(now.getFullYear());
  const [genMonth, setGenMonth] = useState(now.getMonth() + 1);
  const [genEndYear, setGenEndYear] = useState(now.getFullYear());
  const [genEndMonth, setGenEndMonth] = useState(now.getMonth() + 1);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<GenerateResult | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [fcRes, catRes, cpRes, ccRes] = await Promise.all([
      fetch("/api/fixed-costs"),
      fetch("/api/categories"),
      fetch("/api/counterparties"),
      fetch("/api/credit-cards"),
    ]);
    setFixedCosts(await fcRes.json());
    setCategories(await catRes.json());
    setCounterparties(await cpRes.json());
    setCreditCards(await ccRes.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setEditingId(null);
    setType("PAYABLE");
    setDescription("");
    setAmount("");
    setFrequency("MONTHLY");
    setDueDay("5");
    setSecondDueDay("20");
    setWeekday("5");
    setCategoryId("");
    setCounterpartyId("");
    setCreditCardId("");
    setError(null);
  }

  function startEdit(fc: FixedCost) {
    setEditingId(fc.id);
    setType(fc.type);
    setDescription(fc.description);
    setAmount(fc.amount);
    setFrequency(fc.frequency);
    setDueDay(fc.dueDay !== null ? String(fc.dueDay) : "5");
    setSecondDueDay(fc.secondDueDay !== null ? String(fc.secondDueDay) : "20");
    setWeekday(fc.weekday !== null ? String(fc.weekday) : "5");
    setCategoryId(fc.categoryId ?? "");
    setCounterpartyId(fc.counterpartyId ?? "");
    setCreditCardId(fc.creditCardId ?? "");
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const payload = {
      type,
      description,
      amount,
      frequency,
      dueDay: frequency === "MONTHLY" || frequency === "BIWEEKLY" ? dueDay : undefined,
      secondDueDay: frequency === "BIWEEKLY" ? secondDueDay : undefined,
      weekday: frequency === "WEEKLY" ? weekday : undefined,
      categoryId: categoryId || undefined,
      counterpartyId: counterpartyId || undefined,
      creditCardId: creditCardId || undefined,
    };
    const res = await fetch(editingId ? `/api/fixed-costs/${editingId}` : "/api/fixed-costs", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(typeof body.error === "string" ? body.error : "Não foi possível salvar.");
    } else {
      resetForm();
      await load();
    }
    setSubmitting(false);
  }

  async function toggleActive(fc: FixedCost) {
    await fetch(`/api/fixed-costs/${fc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !fc.isActive }),
    });
    await load();
  }

  async function toggleLaborProvision(fc: FixedCost) {
    await fetch(`/api/fixed-costs/${fc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ laborProvisionEligible: !fc.laborProvisionEligible }),
    });
    await load();
  }

  async function handleDelete(fc: FixedCost) {
    if (!confirm(`Excluir "${fc.description}"? Lançamentos já gerados por ele continuam existindo, só perdem o vínculo.`)) {
      return;
    }
    await fetch(`/api/fixed-costs/${fc.id}`, { method: "DELETE" });
    if (editingId === fc.id) resetForm();
    await load();
  }

  async function handleGenerate() {
    setGenerating(true);
    setGenResult(null);
    setGenError(null);
    const res = await fetch("/api/fixed-costs/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        year: genYear,
        month: genMonth,
        endYear: genEndYear,
        endMonth: genEndMonth,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      setGenError(typeof body.error === "string" ? body.error : "Não foi possível gerar.");
    } else {
      setGenResult(body as GenerateResult);
    }
    setGenerating(false);
  }

  const visibleFixedCosts = cardFilter
    ? fixedCosts.filter((fc) => fc.creditCardId === cardFilter)
    : fixedCosts;
  const activeFixedCosts = visibleFixedCosts.filter((fc) => fc.isActive);
  const totalPayable = activeFixedCosts
    .filter((fc) => fc.type === "PAYABLE")
    .reduce((sum, fc) => sum + Number(fc.amount), 0);
  const totalReceivable = activeFixedCosts
    .filter((fc) => fc.type === "RECEIVABLE")
    .reduce((sum, fc) => sum + Number(fc.amount), 0);
  const monthlyTotalPayable = activeFixedCosts
    .filter((fc) => fc.type === "PAYABLE")
    .reduce((sum, fc) => sum + monthlyAmount(fc, now.getFullYear(), now.getMonth() + 1), 0);
  const monthlyTotalReceivable = activeFixedCosts
    .filter((fc) => fc.type === "RECEIVABLE")
    .reduce((sum, fc) => sum + monthlyAmount(fc, now.getFullYear(), now.getMonth() + 1), 0);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-foreground">Custos fixos</h1>
          <p className="no-print text-sm text-muted">
            Cadastre despesas e receitas recorrentes (aluguel, internet, mensalidades...) e gere os
            lançamentos do mês com um clique, sem precisar recriar tudo na mão.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <div className="text-right">
            <span className="block text-xs font-medium tracking-wide text-muted uppercase">
              Total a pagar ({activeFixedCosts.filter((fc) => fc.type === "PAYABLE").length} ativos)
            </span>
            <span className="font-serif text-2xl text-gold">{formatBRL(totalPayable)}</span>
          </div>
          <div
            className="text-right"
            title="Considera quantas vezes cada custo cai no mês atual — semanal conta 4 ou 5 vezes, quinzenal conta 2."
          >
            <span className="block text-xs font-medium tracking-wide text-muted uppercase">
              Valor mensal a pagar ({MONTHS[now.getMonth()]}/{now.getFullYear()})
            </span>
            <span className="font-serif text-2xl text-gold">{formatBRL(monthlyTotalPayable)}</span>
          </div>
          {totalReceivable > 0 && (
            <div className="text-right">
              <span className="block text-xs font-medium tracking-wide text-muted uppercase">
                Total a receber ({activeFixedCosts.filter((fc) => fc.type === "RECEIVABLE").length}{" "}
                ativos)
              </span>
              <span className="font-serif text-2xl text-emerald-400">
                {formatBRL(totalReceivable)}
              </span>
            </div>
          )}
          {monthlyTotalReceivable > 0 && (
            <div className="text-right">
              <span className="block text-xs font-medium tracking-wide text-muted uppercase">
                Valor mensal a receber
              </span>
              <span className="font-serif text-2xl text-emerald-400">
                {formatBRL(monthlyTotalReceivable)}
              </span>
            </div>
          )}
          <PrintButton />
        </div>
      </div>

      {creditCards.length > 0 && (
        <div className="no-print flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface px-4 py-2">
          <span className="mr-1 text-xs text-muted">Cartão</span>
          <button
            type="button"
            onClick={() => setCardFilter("")}
            className={
              cardFilter === ""
                ? "rounded bg-gold px-2.5 py-1 text-xs font-medium text-black"
                : "rounded px-2.5 py-1 text-xs font-medium text-muted transition hover:text-foreground"
            }
          >
            Todos
          </button>
          {creditCards.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCardFilter(c.id)}
              className={
                cardFilter === c.id
                  ? "rounded bg-gold px-2.5 py-1 text-xs font-medium text-black"
                  : "rounded px-2.5 py-1 text-xs font-medium text-muted transition hover:text-foreground"
              }
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="no-print flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Tipo</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
            className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          >
            <option value="PAYABLE">A pagar</option>
            <option value="RECEIVABLE">A receber</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Descrição</label>
          <input
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
            placeholder="Ex.: Aluguel"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Valor</label>
          <input
            required
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-28 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Frequência</label>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as FixedCostFrequency)}
            className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          >
            <option value="MONTHLY">Mensal</option>
            <option value="BIWEEKLY">Quinzenal</option>
            <option value="WEEKLY">Semanal</option>
          </select>
        </div>
        {frequency === "MONTHLY" && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">Dia do vencimento</label>
            <input
              required
              type="number"
              min={1}
              max={31}
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
              className="w-20 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
            />
          </div>
        )}
        {frequency === "BIWEEKLY" && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted">1º dia</label>
              <input
                required
                type="number"
                min={1}
                max={31}
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                className="w-20 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted">2º dia</label>
              <input
                required
                type="number"
                min={1}
                max={31}
                value={secondDueDay}
                onChange={(e) => setSecondDueDay(e.target.value)}
                className="w-20 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
              />
            </div>
          </>
        )}
        {frequency === "WEEKLY" && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">Dia da semana</label>
            <select
              value={weekday}
              onChange={(e) => setWeekday(e.target.value)}
              className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
            >
              {WEEKDAY_LABELS.map((label, idx) => (
                <option key={idx} value={idx}>
                  {label.charAt(0).toUpperCase() + label.slice(1)}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Categoria</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          >
            <option value="">—</option>
            {categories
              .filter((c) => !c.parentId)
              .map((parent) => (
                <Fragment key={parent.id}>
                  <option value={parent.id}>{parent.name}</option>
                  {categories
                    .filter((c) => c.parentId === parent.id)
                    .map((child) => (
                      <option key={child.id} value={child.id}>
                        {"  "}└ {child.name}
                      </option>
                    ))}
                </Fragment>
              ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Contraparte</label>
          <select
            value={counterpartyId}
            onChange={(e) => setCounterpartyId(e.target.value)}
            className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          >
            <option value="">—</option>
            {counterparties.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label
            className="text-xs font-medium text-muted"
            title="Se essa despesa cai num cartão de crédito específico (ex.: assinatura de streaming), selecione qual — assim dá pra filtrar e ver o total mensal por cartão."
          >
            Cartão (opcional)
          </label>
          <select
            value={creditCardId}
            onChange={(e) => setCreditCardId(e.target.value)}
            className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          >
            <option value="">—</option>
            {creditCards.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-gold px-4 py-1.5 text-sm font-medium text-black transition hover:bg-gold-soft disabled:opacity-50"
        >
          {submitting ? "Salvando..." : editingId ? "Salvar alterações" : "Adicionar custo fixo"}
        </button>
        {editingId && (
          <button
            type="button"
            onClick={resetForm}
            className="rounded border border-border px-4 py-1.5 text-sm font-medium text-muted transition hover:text-foreground"
          >
            Cancelar
          </button>
        )}
      </form>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : visibleFixedCosts.length === 0 ? (
        <p className="text-sm text-muted">
          {cardFilter ? "Nenhum custo fixo nesse cartão." : "Nenhum custo fixo cadastrado ainda."}
        </p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="py-2 font-medium">Descrição</th>
              <th className="py-2 font-medium">Tipo</th>
              <th className="py-2 font-medium">Valor</th>
              <th className="py-2 font-medium">Vencimento</th>
              <th className="py-2 font-medium">Categoria</th>
              <th className="py-2 font-medium">Contraparte</th>
              <th className="py-2 font-medium">Cartão</th>
              <th className="py-2 font-medium" title="Conta na provisão de 13º/férias, na tela Reserva de Caixa">
                13º/Férias
              </th>
              <th className="py-2 font-medium">Status</th>
              <th className="no-print py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {[...visibleFixedCosts]
              .sort((a, b) => scheduleSortKey(a) - scheduleSortKey(b))
              .map((fc) => (
              <tr key={fc.id} className="border-b border-border/50">
                <td className="py-2">{fc.description}</td>
                <td className="py-2">{fc.type === "PAYABLE" ? "A pagar" : "A receber"}</td>
                <td className="py-2">{formatBRL(fc.amount)}</td>
                <td className="py-2">{scheduleLabel(fc)}</td>
                <td className="py-2">{fc.category?.name ?? "—"}</td>
                <td className="py-2">{fc.counterparty?.name ?? "—"}</td>
                <td className="py-2">{fc.creditCard?.name ?? "—"}</td>
                <td className="py-2">
                  <button
                    onClick={() => toggleLaborProvision(fc)}
                    className={`no-print rounded px-2 py-0.5 text-xs font-medium ${
                      fc.laborProvisionEligible
                        ? "bg-gold/20 text-gold"
                        : "bg-surface-hover text-muted hover:text-foreground"
                    }`}
                  >
                    {fc.laborProvisionEligible ? "Sim" : "Não"}
                  </button>
                  <span className="print:inline hidden text-xs">
                    {fc.laborProvisionEligible ? "Sim" : "Não"}
                  </span>
                </td>
                <td className="py-2">
                  <span className={fc.isActive ? "text-emerald-400" : "text-muted"}>
                    {fc.isActive ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="no-print py-2 whitespace-nowrap">
                  <button
                    onClick={() => toggleActive(fc)}
                    className="mr-3 text-xs font-medium text-gold hover:text-gold-soft hover:underline"
                  >
                    {fc.isActive ? "Desativar" : "Ativar"}
                  </button>
                  <button
                    onClick={() => startEdit(fc)}
                    className="mr-3 text-xs font-medium text-gold hover:text-gold-soft hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(fc)}
                    className="text-xs font-medium text-red-400 hover:underline"
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="no-print flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="font-serif text-xl text-foreground">Gerar lançamentos</h2>
        <p className="text-sm text-muted">
          Cria automaticamente um lançamento pendente pra cada custo fixo ativo, em cada mês do
          intervalo selecionado (passado ou futuro). Não duplica: se já existe um lançamento
          desse custo fixo naquele mês, ele é pulado — depois é só conferir em Lançamentos e
          editar/excluir o que precisar.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1">
            <span className="mr-1 text-xs text-muted">De — Ano</span>
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setGenYear(y)}
                className={
                  y === genYear
                    ? "rounded bg-gold px-2.5 py-1 text-xs font-medium text-black"
                    : "rounded px-2.5 py-1 text-xs font-medium text-muted transition hover:text-foreground"
                }
              >
                {y}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="mr-1 text-xs text-muted">Mês</span>
            {MONTHS.map((label, idx) => (
              <button
                key={label}
                type="button"
                onClick={() => setGenMonth(idx + 1)}
                className={
                  idx + 1 === genMonth
                    ? "rounded bg-gold px-2.5 py-1 text-xs font-medium text-black"
                    : "rounded px-2.5 py-1 text-xs font-medium text-muted transition hover:text-foreground"
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1">
            <span className="mr-1 text-xs text-muted">Até — Ano</span>
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setGenEndYear(y)}
                className={
                  y === genEndYear
                    ? "rounded bg-gold px-2.5 py-1 text-xs font-medium text-black"
                    : "rounded px-2.5 py-1 text-xs font-medium text-muted transition hover:text-foreground"
                }
              >
                {y}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="mr-1 text-xs text-muted">Mês</span>
            {MONTHS.map((label, idx) => (
              <button
                key={label}
                type="button"
                onClick={() => setGenEndMonth(idx + 1)}
                className={
                  idx + 1 === genEndMonth
                    ? "rounded bg-gold px-2.5 py-1 text-xs font-medium text-black"
                    : "rounded px-2.5 py-1 text-xs font-medium text-muted transition hover:text-foreground"
                }
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="rounded bg-gold px-4 py-1.5 text-sm font-medium text-black transition hover:bg-gold-soft disabled:opacity-50"
          >
            {generating ? "Gerando..." : "Gerar lançamentos"}
          </button>
        </div>
        {genError && <p className="text-sm text-red-400">{genError}</p>}
        {genResult && (
          <div className="text-sm text-foreground">
            <p>
              {genResult.generated} lançamento(s) gerado(s) no total, {genResult.skipped} já
              existia(m) (de {genResult.total} custo(s) fixo(s) ativo(s)).
            </p>
            {genResult.byMonth && genResult.byMonth.length > 1 && (
              <ul className="mt-1 text-xs text-muted">
                {genResult.byMonth.map((m) => (
                  <li key={`${m.year}-${m.month}`}>
                    {MONTHS[m.month - 1]}/{m.year}: {m.generated} gerado(s), {m.skipped} já
                    existia(m)
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
