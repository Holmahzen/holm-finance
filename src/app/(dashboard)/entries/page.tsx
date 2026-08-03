"use client";

import { Fragment, useEffect, useState, type FormEvent } from "react";
import { formatBRL } from "@/lib/format";
import { PeriodFilter } from "@/components/PeriodFilter";

type Entry = {
  id: string;
  type: "PAYABLE" | "RECEIVABLE";
  description: string;
  amount: string;
  dueDate: string;
  plannedPaymentDate: string | null;
  paidAt: string | null;
  status: "PENDING" | "PAID" | "CANCELED";
  category: { id: string; name: string } | null;
  counterparty: { id: string; name: string } | null;
};

type Option = { id: string; name: string };
type CategoryOption = Option & { parentId: string | null };

type PaymentStatus = "PAGO" | "VENCIDA" | "VENCE_HOJE" | "EM_ABERTO" | "CANCELADO";

const paymentStatusMeta: Record<PaymentStatus, { label: string; className: string }> = {
  PAGO: { label: "PAGO", className: "text-emerald-400" },
  VENCIDA: { label: "VENCIDA", className: "text-red-400" },
  VENCE_HOJE: { label: "VENCE HOJE", className: "text-sky-400" },
  EM_ABERTO: { label: "EM ABERTO", className: "text-amber-400" },
  CANCELADO: { label: "CANCELADO", className: "text-muted" },
};

function toUTCDateOnly(date: Date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

function todayLocalDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPaymentStatus(entry: Entry): PaymentStatus {
  if (entry.status === "PAID") return "PAGO";
  if (entry.status === "CANCELED") return "CANCELADO";

  const due = new Date(entry.dueDate);
  const dueUTC = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const todayUTC = toUTCDateOnly(new Date());

  if (dueUTC < todayUTC) return "VENCIDA";
  if (dueUTC === todayUTC) return "VENCE_HOJE";
  return "EM_ABERTO";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

const now = new Date();

export default function EntriesPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [counterparties, setCounterparties] = useState<Option[]>([]);
  const [accounts, setAccounts] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewType, setViewType] = useState<"PAYABLE" | "RECEIVABLE">("PAYABLE");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [type, setType] = useState<"PAYABLE" | "RECEIVABLE">("PAYABLE");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [plannedPaymentDate, setPlannedPaymentDate] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [counterpartyId, setCounterpartyId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [uploadingBoleto, setUploadingBoleto] = useState(false);
  const [boletoError, setBoletoError] = useState<string | null>(null);

  const [boletoCode, setBoletoCode] = useState("");
  const [parsingBoletoCode, setParsingBoletoCode] = useState(false);
  const [boletoCodeError, setBoletoCodeError] = useState<string | null>(null);

  const [payingId, setPayingId] = useState<string | null>(null);
  const [payAccountId, setPayAccountId] = useState("");
  const [payDate, setPayDate] = useState("");

  const [editingPlannedId, setEditingPlannedId] = useState<string | null>(null);
  const [plannedDateValue, setPlannedDateValue] = useState("");

  async function load() {
    setLoading(true);
    const [entriesRes, categoriesRes, counterpartiesRes, accountsRes] = await Promise.all([
      fetch(`/api/entries?type=${viewType}&year=${year}&month=${month}`),
      fetch("/api/categories"),
      fetch("/api/counterparties"),
      fetch("/api/accounts"),
    ]);
    setEntries(await entriesRes.json());
    setCategories(await categoriesRes.json());
    setCounterparties(await counterpartiesRes.json());
    setAccounts(await accountsRes.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewType, year, month]);

  function resetForm() {
    setEditingId(null);
    setType("PAYABLE");
    setDescription("");
    setAmount("");
    setDueDate("");
    setPlannedPaymentDate("");
    setCategoryId("");
    setCounterpartyId("");
    setFormError(null);
  }

  function startEdit(entry: Entry) {
    setEditingId(entry.id);
    setType(entry.type);
    setDescription(entry.description);
    setAmount(entry.amount);
    setDueDate(entry.dueDate.slice(0, 10));
    setPlannedPaymentDate(entry.plannedPaymentDate ? entry.plannedPaymentDate.slice(0, 10) : "");
    setCategoryId(entry.category?.id ?? "");
    setCounterpartyId(entry.counterparty?.id ?? "");
    setFormError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    const payload = {
      type,
      description,
      amount,
      dueDate,
      plannedPaymentDate: plannedPaymentDate || undefined,
      categoryId: categoryId || undefined,
      counterpartyId: counterpartyId || undefined,
    };
    const res = await fetch(editingId ? `/api/entries/${editingId}` : "/api/entries", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json();
      setFormError(typeof body.error === "string" ? body.error : "Não foi possível salvar.");
      setSubmitting(false);
      return;
    }
    resetForm();
    setSubmitting(false);
    await load();
  }

  function applyParsedBoleto(body: {
    bankName?: string | null;
    bankCode?: string | null;
    amount: string;
    dueDate: string | null;
    source: string;
  }) {
    setEditingId(null);
    setType("PAYABLE");
    setDescription(
      body.bankName
        ? `Boleto — ${body.bankName}`
        : body.bankCode
          ? `Boleto — banco ${body.bankCode}`
          : "Boleto",
    );
    setAmount(body.amount);
    setDueDate(body.dueDate ? body.dueDate.slice(0, 10) : "");
    setPlannedPaymentDate("");
    setCategoryId("");
    setCounterpartyId("");
    return body.source === "texto";
  }

  async function handleUploadBoleto(file: File) {
    setUploadingBoleto(true);
    setBoletoError(null);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/imports/boleto", { method: "POST", body: formData });
    const body = await res.json();
    if (!res.ok) {
      setBoletoError(typeof body.error === "string" ? body.error : "Não foi possível ler o boleto.");
      setUploadingBoleto(false);
      return;
    }
    const cameFromText = applyParsedBoleto(body);
    if (cameFromText) {
      setBoletoError(
        "Não achei o código de barras como texto (comum em contas de concessionária) — valor e vencimento vieram do texto do boleto. Confira com atenção antes de salvar.",
      );
    }
    setUploadingBoleto(false);
  }

  async function handlePasteBoletoCode() {
    if (!boletoCode.trim()) return;
    setParsingBoletoCode(true);
    setBoletoCodeError(null);
    const res = await fetch("/api/imports/boleto-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: boletoCode }),
    });
    const body = await res.json();
    if (!res.ok) {
      setBoletoCodeError(typeof body.error === "string" ? body.error : "Não foi possível ler o código.");
      setParsingBoletoCode(false);
      return;
    }
    applyParsedBoleto(body);
    setBoletoCode("");
    setParsingBoletoCode(false);
  }

  async function handleDelete(entry: Entry) {
    if (!confirm(`Excluir o lançamento "${entry.description}"? Essa ação não pode ser desfeita.`)) return;
    const res = await fetch(`/api/entries/${entry.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json();
      alert(typeof body.error === "string" ? body.error : "Não foi possível excluir.");
      return;
    }
    await load();
  }

  async function handlePay(id: string) {
    if (!payAccountId || !payDate) return;
    await fetch(`/api/entries/${id}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bankAccountId: payAccountId, paidAt: payDate }),
    });
    setPayingId(null);
    setPayAccountId("");
    setPayDate("");
    await load();
  }

  async function savePlannedDate(id: string) {
    await fetch(`/api/entries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plannedPaymentDate: plannedDateValue || null }),
    });
    setEditingPlannedId(null);
    setPlannedDateValue("");
    await load();
  }

  const counts: Record<PaymentStatus, number> = {
    PAGO: 0,
    VENCIDA: 0,
    VENCE_HOJE: 0,
    EM_ABERTO: 0,
    CANCELADO: 0,
  };
  let total = 0;
  for (const entry of entries) {
    counts[getPaymentStatus(entry)]++;
    total += Number(entry.amount);
  }

  const visibleEntries = statusFilter
    ? entries.filter((entry) => getPaymentStatus(entry) === statusFilter)
    : entries;
  const visibleTotal = visibleEntries.reduce((sum, entry) => sum + Number(entry.amount), 0);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-foreground">
            {viewType === "PAYABLE" ? "Controle de Pagamento" : "Controle de Recebimento"}
          </h1>
          <p className="text-sm text-muted">Contas a pagar e a receber.</p>
        </div>
        <div className="text-right">
          <span className="block text-xs font-medium tracking-wide text-muted uppercase">
            Total ({visibleEntries.length})
          </span>
          <span className="font-serif text-2xl text-gold">{formatBRL(visibleTotal)}</span>
        </div>
      </div>

      <div className="flex gap-1 rounded-lg border border-border bg-surface p-1 w-fit">
        <button
          type="button"
          onClick={() => setViewType("PAYABLE")}
          className={
            viewType === "PAYABLE"
              ? "rounded bg-gold px-3 py-1.5 text-sm font-medium text-black"
              : "rounded px-3 py-1.5 text-sm font-medium text-muted transition hover:text-foreground"
          }
        >
          A pagar
        </button>
        <button
          type="button"
          onClick={() => setViewType("RECEIVABLE")}
          className={
            viewType === "RECEIVABLE"
              ? "rounded bg-gold px-3 py-1.5 text-sm font-medium text-black"
              : "rounded px-3 py-1.5 text-sm font-medium text-muted transition hover:text-foreground"
          }
        >
          A receber
        </button>
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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {(
          [
            { status: "PAGO" as const, label: "Pago", value: counts.PAGO, className: "text-emerald-400" },
            { status: "VENCIDA" as const, label: "Vencida", value: counts.VENCIDA, className: "text-red-400" },
            { status: "EM_ABERTO" as const, label: "Em aberto", value: counts.EM_ABERTO, className: "text-amber-400" },
            { status: "VENCE_HOJE" as const, label: "Vence hoje", value: counts.VENCE_HOJE, className: "text-sky-400" },
          ]
        ).map((card) => (
          <button
            key={card.status}
            type="button"
            onClick={() => setStatusFilter((prev) => (prev === card.status ? null : card.status))}
            className={`rounded-lg border p-4 text-left transition ${
              statusFilter === card.status
                ? "border-gold bg-surface-hover"
                : "border-border bg-surface hover:border-gold/50"
            }`}
          >
            <span className="text-xs font-medium tracking-wide text-muted uppercase">{card.label}</span>
            <p className={`font-serif text-2xl ${card.className}`}>{card.value}</p>
          </button>
        ))}
      </div>

      {statusFilter && (
        <div className="flex items-center gap-2 text-sm text-muted">
          Filtrando por <span className="font-medium text-foreground">{paymentStatusMeta[statusFilter].label}</span>
          <button
            type="button"
            onClick={() => setStatusFilter(null)}
            className="text-gold hover:underline"
          >
            limpar filtro
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Preencher a partir de um boleto (PDF)</label>
          <input
            type="file"
            accept="application/pdf"
            disabled={uploadingBoleto}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUploadBoleto(file);
              e.target.value = "";
            }}
            className="text-sm text-foreground file:mr-2 file:rounded file:border-0 file:bg-gold file:px-3 file:py-1 file:text-black"
          />
        </div>
        {uploadingBoleto && <span className="text-xs text-muted">Lendo boleto...</span>}
        {boletoError && <span className="text-xs text-red-400">{boletoError}</span>}
        <span className="text-xs text-muted">
          Extrai valor, vencimento e banco automaticamente — confira os dados antes de salvar.
        </span>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">
            Ou cole a linha digitável / código de barras
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={boletoCode}
              onChange={(e) => setBoletoCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handlePasteBoletoCode();
                }
              }}
              placeholder="34191.09008 61713.157308 ..."
              disabled={parsingBoletoCode}
              className="w-72 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
            />
            <button
              type="button"
              onClick={handlePasteBoletoCode}
              disabled={parsingBoletoCode || !boletoCode.trim()}
              className="whitespace-nowrap rounded bg-gold px-3 py-1.5 text-sm font-medium text-black transition hover:bg-gold-soft disabled:opacity-50"
            >
              {parsingBoletoCode ? "Lendo..." : "Preencher"}
            </button>
          </div>
        </div>
        {boletoCodeError && <span className="text-xs text-red-400">{boletoCodeError}</span>}
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Tipo</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as Entry["type"])}
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
          <label className="text-xs font-medium text-muted">Vencimento</label>
          <input
            required
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Data planejada (opcional)</label>
          <input
            type="date"
            value={plannedPaymentDate}
            onChange={(e) => setPlannedPaymentDate(e.target.value)}
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
          disabled={submitting}
          className="rounded bg-gold px-4 py-1.5 text-sm font-medium text-black transition hover:bg-gold-soft disabled:opacity-50"
        >
          {submitting ? "Salvando..." : editingId ? "Salvar edição" : "Adicionar lançamento"}
        </button>
        {editingId && (
          <button
            type="button"
            onClick={resetForm}
            className="text-sm text-muted hover:text-foreground hover:underline"
          >
            Cancelar
          </button>
        )}
        {formError && <p className="w-full text-sm text-red-400">{formError}</p>}
      </form>

      {loading ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted">Nenhum lançamento cadastrado ainda.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="py-2 font-medium">Descrição</th>
              <th className="py-2 font-medium">Valor</th>
              <th className="py-2 font-medium">Vencimento</th>
              <th className="py-2 font-medium">Data planejada</th>
              <th className="py-2 font-medium">Data de pagamento</th>
              <th className="py-2 font-medium">Categoria</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 font-medium"></th>
              <th className="py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {visibleEntries.map((entry) => {
              const paymentStatus = paymentStatusMeta[getPaymentStatus(entry)];
              return (
                <tr key={entry.id} className="border-b border-border/50">
                  <td className="py-2">{entry.description}</td>
                  <td className="py-2">{formatBRL(entry.amount)}</td>
                  <td className="py-2">{formatDate(entry.dueDate)}</td>
                  <td className="py-2">
                    {editingPlannedId === entry.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="date"
                          value={plannedDateValue}
                          onChange={(e) => setPlannedDateValue(e.target.value)}
                          className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
                        />
                        <button
                          onClick={() => savePlannedDate(entry.id)}
                          className="text-xs font-medium text-gold hover:text-gold-soft"
                        >
                          Salvar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingPlannedId(entry.id);
                          setPlannedDateValue(
                            entry.plannedPaymentDate
                              ? entry.plannedPaymentDate.slice(0, 10)
                              : "",
                          );
                        }}
                        className="text-muted hover:text-gold"
                      >
                        {entry.plannedPaymentDate ? formatDate(entry.plannedPaymentDate) : "—"}
                      </button>
                    )}
                  </td>
                  <td className="py-2 text-muted">
                    {entry.paidAt ? formatDate(entry.paidAt) : "—"}
                  </td>
                  <td className="py-2">{entry.category?.name ?? "—"}</td>
                  <td className="py-2">
                    <span className={`text-xs font-semibold ${paymentStatus.className}`}>
                      {paymentStatus.label}
                    </span>
                  </td>
                  <td className="py-2">
                    {entry.status === "PENDING" &&
                      (payingId === entry.id ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={payAccountId}
                            onChange={(e) => setPayAccountId(e.target.value)}
                            className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
                          >
                            <option value="">Conta...</option>
                            {accounts.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="date"
                            value={payDate}
                            onChange={(e) => setPayDate(e.target.value)}
                            className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
                          />
                          <button
                            onClick={() => handlePay(entry.id)}
                            className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white transition hover:bg-emerald-500"
                          >
                            Confirmar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setPayingId(entry.id);
                            setPayDate(todayLocalDateString());
                          }}
                          className="text-xs font-medium text-gold hover:text-gold-soft hover:underline"
                        >
                          Marcar como pago
                        </button>
                      ))}
                  </td>
                  <td className="py-2 whitespace-nowrap">
                    <button
                      onClick={() => startEdit(entry)}
                      className="mr-3 text-xs font-medium text-gold hover:text-gold-soft hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(entry)}
                      className="text-xs font-medium text-red-400 hover:underline"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
