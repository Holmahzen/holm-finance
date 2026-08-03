"use client";

import { useEffect, useState, type FormEvent } from "react";
import { formatBRL } from "@/lib/format";
import { computePriceAmortization } from "@/domain/loanAmortization";

type CategoryOption = { id: string; name: string };

type Loan = {
  id: string;
  description: string;
  principal: string;
  monthlyRatePercent: string;
  installments: number;
  matchText: string;
  categoryId: string;
  isActive: boolean;
  category: { name: string };
};

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [principal, setPrincipal] = useState("");
  const [monthlyRatePercent, setMonthlyRatePercent] = useState("");
  const [installments, setInstallments] = useState("");
  const [matchText, setMatchText] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [loansRes, catRes] = await Promise.all([
      fetch("/api/loans"),
      fetch("/api/categories"),
    ]);
    setLoans(await loansRes.json());
    setCategories(await catRes.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function resetForm() {
    setEditingId(null);
    setDescription("");
    setPrincipal("");
    setMonthlyRatePercent("");
    setInstallments("");
    setMatchText("");
    setCategoryId("");
    setError(null);
  }

  function startEdit(loan: Loan) {
    setEditingId(loan.id);
    setDescription(loan.description);
    setPrincipal(loan.principal);
    setMonthlyRatePercent(loan.monthlyRatePercent);
    setInstallments(String(loan.installments));
    setMatchText(loan.matchText);
    setCategoryId(loan.categoryId);
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const payload = {
      description,
      principal,
      monthlyRatePercent,
      installments,
      matchText,
      categoryId,
    };
    const res = await fetch(editingId ? `/api/loans/${editingId}` : "/api/loans", {
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

  async function toggleActive(loan: Loan) {
    await fetch(`/api/loans/${loan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !loan.isActive }),
    });
    await load();
  }

  async function handleDelete(loan: Loan) {
    if (!confirm(`Excluir "${loan.description}"? Os lançamentos já pagos não são afetados.`)) return;
    await fetch(`/api/loans/${loan.id}`, { method: "DELETE" });
    if (editingId === loan.id) resetForm();
    await load();
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-3xl text-foreground">Empréstimos</h1>
        <p className="text-sm text-muted">
          Cadastre aqui os empréstimos parcelados (tabela Price, parcela fixa). A DRE passa a
          contar só a parte de juros de cada parcela paga como despesa financeira — o principal
          (entrada do crédito e amortização) não entra no resultado. Pra identificar os
          lançamentos certos, use um trecho que apareça só na descrição das parcelas desse
          empréstimo (ex.: o número do contrato).
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Descrição</label>
          <input
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
            placeholder="Ex.: Empréstimo Sicredi"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Valor liberado (R$)</label>
          <input
            required
            type="number"
            step="0.01"
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
            className="w-28 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Taxa ao mês (%)</label>
          <input
            required
            type="number"
            step="0.0001"
            value={monthlyRatePercent}
            onChange={(e) => setMonthlyRatePercent(e.target.value)}
            className="w-24 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Nº de parcelas</label>
          <input
            required
            type="number"
            min={1}
            value={installments}
            onChange={(e) => setInstallments(e.target.value)}
            className="w-20 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Texto que identifica a parcela</label>
          <input
            required
            value={matchText}
            onChange={(e) => setMatchText(e.target.value)}
            className="w-40 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
            placeholder="Ex.: C68230670"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Categoria</label>
          <select
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          >
            <option value="">Selecione...</option>
            {categories.map((c) => (
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
          {submitting ? "Salvando..." : editingId ? "Salvar alterações" : "Adicionar empréstimo"}
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
      ) : loans.length === 0 ? (
        <p className="text-sm text-muted">Nenhum empréstimo cadastrado ainda.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="py-2 font-medium">Descrição</th>
              <th className="py-2 font-medium">Valor liberado</th>
              <th className="py-2 font-medium">Taxa/mês</th>
              <th className="py-2 font-medium">Parcelas</th>
              <th className="py-2 font-medium">Parcela calculada</th>
              <th className="py-2 font-medium">1ª parcela: juros</th>
              <th className="py-2 font-medium">Categoria</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loans.map((loan) => {
              const schedule = computePriceAmortization(
                Number(loan.principal),
                Number(loan.monthlyRatePercent),
                loan.installments,
              );
              const first = schedule[0];
              return (
                <tr key={loan.id} className="border-b border-border/50">
                  <td className="py-2">{loan.description}</td>
                  <td className="py-2">{formatBRL(loan.principal)}</td>
                  <td className="py-2">{Number(loan.monthlyRatePercent).toFixed(2)}%</td>
                  <td className="py-2">{loan.installments}x</td>
                  <td className="py-2">{first ? formatBRL(first.payment) : "—"}</td>
                  <td className="py-2">{first ? formatBRL(first.interest) : "—"}</td>
                  <td className="py-2">{loan.category?.name ?? "—"}</td>
                  <td className="py-2">
                    <span className={loan.isActive ? "text-emerald-400" : "text-muted"}>
                      {loan.isActive ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="py-2 whitespace-nowrap">
                    <button
                      onClick={() => toggleActive(loan)}
                      className="mr-3 text-xs font-medium text-gold hover:text-gold-soft hover:underline"
                    >
                      {loan.isActive ? "Desativar" : "Ativar"}
                    </button>
                    <button
                      onClick={() => startEdit(loan)}
                      className="mr-3 text-xs font-medium text-gold hover:text-gold-soft hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(loan)}
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
