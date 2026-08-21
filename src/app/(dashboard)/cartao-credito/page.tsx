"use client";

import { Fragment, useEffect, useState, type FormEvent } from "react";
import { formatBRL } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";
import { computeMonthlyCommitment } from "@/domain/creditCardCommitment";

type CreditCard = { id: string; name: string; isActive: boolean };
type Option = { id: string; name: string };
type CategoryOption = Option & { parentId: string | null };

type InstallmentEntry = {
  id: string;
  description: string;
  amount: string;
  dueDate: string;
  status: "PENDING" | "PAID" | "CANCELED";
  installmentNumber: number | null;
};

type Purchase = {
  id: string;
  description: string;
  totalAmount: string;
  installments: number;
  purchaseDate: string;
  creditCard: { id: string; name: string };
  category: { id: string; name: string } | null;
  counterparty: { id: string; name: string } | null;
  generatedEntries: InstallmentEntry[];
};

type AverageRevenue = { averageRevenue: number; revenueMonthsBack: number };

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function commitmentTone(percent: number | null) {
  if (percent === null) return "text-foreground";
  if (percent >= 60) return "text-red-400";
  if (percent >= 30) return "text-amber-400";
  return "text-gold";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function todayLocalDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isSameUTCMonth(isoDate: string, year: number, month: number) {
  const d = new Date(isoDate);
  return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month;
}

export default function CreditCardPage() {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [counterparties, setCounterparties] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cardFilter, setCardFilter] = useState("");
  const [averageRevenue, setAverageRevenue] = useState<AverageRevenue | null>(null);

  const [newCardName, setNewCardName] = useState("");
  const [addingCard, setAddingCard] = useState(false);

  const [creditCardId, setCreditCardId] = useState("");
  const [description, setDescription] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [installments, setInstallments] = useState("1");
  const [paidInstallments, setPaidInstallments] = useState("0");
  const [purchaseDate, setPurchaseDate] = useState(todayLocalDateString());
  const [firstDueDate, setFirstDueDate] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [counterpartyId, setCounterpartyId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCreditCardId, setEditCreditCardId] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editCounterpartyId, setEditCounterpartyId] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [cardsRes, purchasesRes, categoriesRes, counterpartiesRes, revenueRes] = await Promise.all([
      fetch("/api/credit-cards"),
      fetch("/api/credit-card-purchases"),
      fetch("/api/categories"),
      fetch("/api/counterparties"),
      fetch("/api/credit-card-purchases/average-revenue"),
    ]);
    setCards(await cardsRes.json());
    setPurchases(await purchasesRes.json());
    setCategories(await categoriesRes.json());
    setCounterparties(await counterpartiesRes.json());
    setAverageRevenue(await revenueRes.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setCreditCardId("");
    setDescription("");
    setTotalAmount("");
    setInstallments("1");
    setPaidInstallments("0");
    setPurchaseDate(todayLocalDateString());
    setFirstDueDate("");
    setCategoryId("");
    setCounterpartyId("");
    setError(null);
  }

  async function handleAddCard(e: FormEvent) {
    e.preventDefault();
    if (!newCardName.trim()) return;
    setAddingCard(true);
    const res = await fetch("/api/credit-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCardName.trim() }),
    });
    if (res.ok) {
      setNewCardName("");
      await load();
    }
    setAddingCard(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/credit-card-purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creditCardId,
        description,
        totalAmount,
        installments,
        paidInstallments,
        purchaseDate,
        firstDueDate,
        categoryId: categoryId || undefined,
        counterpartyId: counterpartyId || undefined,
      }),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(typeof body.error === "string" ? body.error : "Não foi possível salvar a compra.");
      setSubmitting(false);
      return;
    }
    resetForm();
    setSubmitting(false);
    await load();
  }

  function startEdit(purchase: Purchase) {
    setEditingId(purchase.id);
    setEditCreditCardId(purchase.creditCard.id);
    setEditDescription(purchase.description);
    setEditCategoryId(purchase.category?.id ?? "");
    setEditCounterpartyId(purchase.counterparty?.id ?? "");
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  async function handleEditSubmit(e: FormEvent, purchaseId: string) {
    e.preventDefault();
    setEditSubmitting(true);
    setEditError(null);
    const res = await fetch(`/api/credit-card-purchases/${purchaseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creditCardId: editCreditCardId,
        description: editDescription,
        categoryId: editCategoryId || undefined,
        counterpartyId: editCounterpartyId || undefined,
      }),
    });
    if (!res.ok) {
      const body = await res.json();
      setEditError(typeof body.error === "string" ? body.error : "Não foi possível salvar.");
      setEditSubmitting(false);
      return;
    }
    setEditingId(null);
    setEditSubmitting(false);
    await load();
  }

  async function handleDelete(purchase: Purchase) {
    if (
      !confirm(
        `Excluir a compra "${purchase.description}"? As parcelas ainda não pagas são canceladas; as já pagas continuam no histórico de Lançamentos.`,
      )
    )
      return;
    await fetch(`/api/credit-card-purchases/${purchase.id}`, { method: "DELETE" });
    await load();
  }

  const now = new Date();
  const visiblePurchases = cardFilter
    ? purchases.filter((p) => p.creditCard.id === cardFilter)
    : purchases;

  const totalPending = visiblePurchases.reduce((sum, p) => {
    const pendingInPurchase = p.generatedEntries
      .filter((e) => e.status === "PENDING")
      .reduce((s, e) => s + Number(e.amount), 0);
    return sum + pendingInPurchase;
  }, 0);

  const monthlyTotalPending = visiblePurchases.reduce((sum, p) => {
    const dueThisMonth = p.generatedEntries
      .filter((e) => e.status === "PENDING" && isSameUTCMonth(e.dueDate, now.getFullYear(), now.getMonth() + 1))
      .reduce((s, e) => s + Number(e.amount), 0);
    return sum + dueThisMonth;
  }, 0);

  const pendingInstallments = visiblePurchases.flatMap((p) =>
    p.generatedEntries
      .filter((e) => e.status === "PENDING")
      .map((e) => ({ amount: Number(e.amount), dueDate: new Date(e.dueDate) })),
  );
  const committedMonths = computeMonthlyCommitment(pendingInstallments, now.getFullYear(), now.getMonth() + 1, 6);
  const committedMonthsWithPercent = committedMonths.map((m) => ({
    ...m,
    percentOfRevenue:
      averageRevenue && averageRevenue.averageRevenue > 0
        ? (m.committed / averageRevenue.averageRevenue) * 100
        : null,
  }));
  const filteredCardName = cardFilter ? cards.find((c) => c.id === cardFilter)?.name : null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-foreground">Cartão de Crédito</h1>
          <p className="no-print text-sm text-muted">
            Controle das compras parceladas — cada parcela vira um lançamento normal em Lançamentos,
            já datado certinho pra vencer no mês certo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <div className="text-right">
            <span className="block text-xs font-medium tracking-wide text-muted uppercase">
              Total pendente {cardFilter ? "" : "(todos os cartões)"}
            </span>
            <span className="font-serif text-2xl text-gold">{formatBRL(totalPending)}</span>
          </div>
          <div className="text-right">
            <span className="block text-xs font-medium tracking-wide text-muted uppercase">
              Valor mensal a pagar ({MONTHS[now.getMonth()]}/{now.getFullYear()})
            </span>
            <span className="font-serif text-2xl text-gold">{formatBRL(monthlyTotalPending)}</span>
          </div>
          <PrintButton />
        </div>
      </div>

      {averageRevenue && committedMonthsWithPercent.some((m) => m.committed > 0) && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <div>
            <h2 className="font-serif text-lg text-foreground">
              Comprometimento com Cartão — {filteredCardName ?? "Todos os cartões"}
            </h2>
            <p className="text-xs text-muted">
              Quanto das parcelas pendentes{filteredCardName ? ` do ${filteredCardName}` : ""} cai em
              cada mês, comparado com a média de faturamento dos últimos{" "}
              {averageRevenue.revenueMonthsBack} meses ({formatBRL(averageRevenue.averageRevenue)}/mês).
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {committedMonthsWithPercent.map((m) => (
              <div
                key={`${m.year}-${m.month}`}
                className="flex flex-col gap-1 rounded-lg border border-border bg-background p-3"
              >
                <span className="text-xs font-medium tracking-wide text-muted uppercase">
                  {MONTHS[m.month - 1]}/{String(m.year).slice(2)}
                </span>
                <span className="font-serif text-lg text-foreground">{formatBRL(m.committed)}</span>
                <span className={`text-xs font-medium ${commitmentTone(m.percentOfRevenue)}`}>
                  {m.percentOfRevenue !== null ? `${m.percentOfRevenue.toFixed(1)}% da receita` : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {cards.length > 0 && (
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
          {cards.map((c) => (
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

      <div className="no-print flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Cartões cadastrados</label>
          <div className="flex flex-wrap gap-2">
            {cards.length === 0 && <span className="text-sm text-muted">Nenhum cartão ainda.</span>}
            {cards.map((c) => (
              <span
                key={c.id}
                className={`rounded px-2.5 py-1 text-xs font-medium ${
                  c.isActive ? "bg-gold/20 text-gold" : "bg-surface-hover text-muted line-through"
                }`}
              >
                {c.name}
              </span>
            ))}
          </div>
        </div>
        <form onSubmit={handleAddCard} className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">Novo cartão</label>
            <input
              value={newCardName}
              onChange={(e) => setNewCardName(e.target.value)}
              placeholder="Ex.: Nubank Empresa"
              className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={addingCard || !newCardName.trim()}
            className="rounded bg-gold px-3 py-1.5 text-sm font-medium text-black transition hover:bg-gold-soft disabled:opacity-50"
          >
            {addingCard ? "Adicionando..." : "Adicionar cartão"}
          </button>
        </form>
      </div>

      <form
        onSubmit={handleSubmit}
        className="no-print flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Cartão</label>
          <select
            required
            value={creditCardId}
            onChange={(e) => setCreditCardId(e.target.value)}
            className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          >
            <option value="">Selecione...</option>
            {cards
              .filter((c) => c.isActive)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Descrição da compra</label>
          <input
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex.: Tecido fornecedor X"
            className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Valor total</label>
          <input
            required
            type="number"
            step="0.01"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            className="w-28 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Parcelas</label>
          <input
            required
            type="number"
            min={1}
            max={48}
            value={installments}
            onChange={(e) => setInstallments(e.target.value)}
            className="w-20 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            className="text-xs font-medium text-muted"
            title="Pra compras retroativas: se a compra é de um tempo atrás e algumas parcelas já foram pagas, informe quantas — elas entram direto como pagas em vez de pendentes."
          >
            Parcelas já pagas
          </label>
          <input
            type="number"
            min={0}
            max={installments || undefined}
            value={paidInstallments}
            onChange={(e) => setPaidInstallments(e.target.value)}
            className="w-20 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Data da compra</label>
          <input
            required
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Vencimento da 1ª parcela</label>
          <input
            required
            type="date"
            value={firstDueDate}
            onChange={(e) => setFirstDueDate(e.target.value)}
            className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          />
        </div>
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
        <button
          type="submit"
          disabled={submitting || cards.length === 0}
          className="rounded bg-gold px-4 py-1.5 text-sm font-medium text-black transition hover:bg-gold-soft disabled:opacity-50"
        >
          {submitting ? "Salvando..." : "Registrar compra"}
        </button>
        {error && <p className="w-full text-sm text-red-400">{error}</p>}
      </form>

      {loading ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : visiblePurchases.length === 0 ? (
        <p className="text-sm text-muted">
          {cardFilter ? "Nenhuma compra nesse cartão." : "Nenhuma compra registrada ainda."}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {visiblePurchases.map((p) => {
            const paidCount = p.generatedEntries.filter((e) => e.status === "PAID").length;
            const pendingEntries = p.generatedEntries
              .filter((e) => e.status === "PENDING")
              .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
            const nextInstallment = pendingEntries[0] ?? null;
            const expanded = expandedId === p.id;
            const editing = editingId === p.id;

            return (
              <div key={p.id} className="rounded-lg border border-border bg-surface p-4">
                {editing ? (
                  <form
                    onSubmit={(e) => handleEditSubmit(e, p.id)}
                    className="no-print flex flex-wrap items-end gap-3"
                  >
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-muted">Cartão</label>
                      <select
                        required
                        value={editCreditCardId}
                        onChange={(e) => setEditCreditCardId(e.target.value)}
                        className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
                      >
                        {cards.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-muted">Descrição</label>
                      <input
                        required
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-muted">Categoria</label>
                      <select
                        value={editCategoryId}
                        onChange={(e) => setEditCategoryId(e.target.value)}
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
                        value={editCounterpartyId}
                        onChange={(e) => setEditCounterpartyId(e.target.value)}
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
                    <button
                      type="submit"
                      disabled={editSubmitting}
                      className="rounded bg-gold px-3 py-1.5 text-sm font-medium text-black transition hover:bg-gold-soft disabled:opacity-50"
                    >
                      {editSubmitting ? "Salvando..." : "Salvar"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="text-sm text-muted hover:text-foreground hover:underline"
                    >
                      Cancelar
                    </button>
                    {editError && <p className="w-full text-sm text-red-400">{editError}</p>}
                  </form>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-gold/20 px-2 py-0.5 text-xs font-medium text-gold">
                          {p.creditCard.name}
                        </span>
                        <span className="text-sm font-medium text-foreground">{p.description}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        Comprado em {formatDate(p.purchaseDate)}
                        {p.category && <> · {p.category.name}</>}
                        {p.counterparty && <> · {p.counterparty.name}</>}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="block text-xs font-medium tracking-wide text-muted uppercase">
                        {p.installments === 1 ? "À vista" : `${paidCount}/${p.installments} parcelas pagas`}
                      </span>
                      <span className="font-serif text-xl text-foreground">
                        {formatBRL(p.totalAmount)}
                      </span>
                    </div>
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-muted">
                    {nextInstallment ? (
                      <>
                        Próxima parcela: {formatDate(nextInstallment.dueDate)} —{" "}
                        {formatBRL(nextInstallment.amount)}
                      </>
                    ) : (
                      "Todas as parcelas pagas."
                    )}
                  </span>
                  {!editing && (
                    <div className="no-print flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : p.id)}
                        className="text-xs font-medium text-gold hover:text-gold-soft hover:underline"
                      >
                        {expanded ? "Ocultar parcelas" : "Ver parcelas"}
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(p)}
                        className="text-xs font-medium text-gold hover:text-gold-soft hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(p)}
                        className="text-xs font-medium text-red-400 hover:underline"
                      >
                        Excluir
                      </button>
                    </div>
                  )}
                </div>

                {expanded && (
                  <table className="mt-3 w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted">
                        <th className="py-1 font-medium">Parcela</th>
                        <th className="py-1 font-medium">Vencimento</th>
                        <th className="py-1 font-medium">Valor</th>
                        <th className="py-1 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.generatedEntries
                        .slice()
                        .sort((a, b) => (a.installmentNumber ?? 0) - (b.installmentNumber ?? 0))
                        .map((entry) => (
                          <tr key={entry.id} className="border-b border-border/50">
                            <td className="py-1">
                              {entry.installmentNumber}/{p.installments}
                            </td>
                            <td className="py-1">{formatDate(entry.dueDate)}</td>
                            <td className="py-1">{formatBRL(entry.amount)}</td>
                            <td className="py-1">
                              <span
                                className={
                                  entry.status === "PAID"
                                    ? "text-emerald-400"
                                    : entry.status === "CANCELED"
                                      ? "text-muted"
                                      : "text-amber-400"
                                }
                              >
                                {entry.status === "PAID"
                                  ? "PAGO"
                                  : entry.status === "CANCELED"
                                    ? "CANCELADO"
                                    : "PENDENTE"}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
