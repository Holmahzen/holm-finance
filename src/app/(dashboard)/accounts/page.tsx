"use client";

import { useEffect, useState, type FormEvent } from "react";
import { formatBRL } from "@/lib/format";

type Account = {
  id: string;
  name: string;
  type: "BANK" | "CASH";
  bankId: string | null;
  acctId: string | null;
  openingBalance: string;
  isActive: boolean;
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<"BANK" | "CASH">("BANK");
  const [bankId, setBankId] = useState("");
  const [acctId, setAcctId] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadAccounts() {
    setLoading(true);
    const res = await fetch("/api/accounts");
    const data = await res.json();
    setAccounts(data);
    setLoading(false);
  }

  useEffect(() => {
    loadAccounts();
  }, []);

  function resetForm() {
    setEditingId(null);
    setName("");
    setType("BANK");
    setBankId("");
    setAcctId("");
    setOpeningBalance("0");
  }

  function startEdit(account: Account) {
    setEditingId(account.id);
    setName(account.name);
    setType(account.type);
    setBankId(account.bankId ?? "");
    setAcctId(account.acctId ?? "");
    setOpeningBalance(account.openingBalance);
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      name,
      type,
      openingBalance,
      bankId: bankId || undefined,
      acctId: acctId || undefined,
    };

    const res = await fetch(editingId ? `/api/accounts/${editingId}` : "/api/accounts", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(typeof body.error === "string" ? body.error : JSON.stringify(body.error));
      setSubmitting(false);
      return;
    }

    resetForm();
    setSubmitting(false);
    await loadAccounts();
  }

  async function toggleActive(account: Account) {
    await fetch(`/api/accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !account.isActive }),
    });
    await loadAccounts();
  }

  async function handleDelete(account: Account) {
    if (!confirm(`Excluir a conta "${account.name}"? Essa ação não pode ser desfeita.`)) return;
    setError(null);
    const res = await fetch(`/api/accounts/${account.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json();
      setError(typeof body.error === "string" ? body.error : "Não foi possível excluir.");
      return;
    }
    await loadAccounts();
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-3xl text-foreground">Contas bancárias e caixa</h1>
        <p className="text-sm text-muted">
          Cadastre as contas usadas para lançamentos e conciliação.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Nome</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
            placeholder="Ex.: Sicredi, Caixa"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Tipo</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "BANK" | "CASH")}
            className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          >
            <option value="BANK">Banco</option>
            <option value="CASH">Caixa</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">
            Saldo de abertura
          </label>
          <input
            type="number"
            step="0.01"
            value={openingBalance}
            onChange={(e) => setOpeningBalance(e.target.value)}
            className="w-32 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          />
        </div>
        {type === "BANK" && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted">
                Código do banco
              </label>
              <input
                value={bankId}
                onChange={(e) => setBankId(e.target.value)}
                placeholder="Ex.: 748"
                className="w-24 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted">
                Número da conta (ACCTID do OFX)
              </label>
              <input
                value={acctId}
                onChange={(e) => setAcctId(e.target.value)}
                className="w-40 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
              />
            </div>
          </>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-gold px-4 py-1.5 text-sm font-medium text-black transition hover:bg-gold-soft disabled:opacity-50"
        >
          {submitting ? "Salvando..." : editingId ? "Salvar edição" : "Adicionar conta"}
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
        {error && <p className="w-full text-sm text-red-400">{error}</p>}
      </form>

      {loading ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma conta cadastrada ainda.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="py-2 font-medium">Nome</th>
              <th className="py-2 font-medium">Tipo</th>
              <th className="py-2 font-medium">Banco / Conta</th>
              <th className="py-2 font-medium">Saldo de abertura</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr
                key={account.id}
                className="border-b border-border/50"
              >
                <td className="py-2">{account.name}</td>
                <td className="py-2">
                  {account.type === "BANK" ? "Banco" : "Caixa"}
                </td>
                <td className="py-2">
                  {account.bankId && account.acctId
                    ? `${account.bankId} / ${account.acctId}`
                    : "—"}
                </td>
                <td className="py-2">{formatBRL(account.openingBalance)}</td>
                <td className="py-2">
                  <span className={account.isActive ? "text-emerald-400" : "text-muted"}>
                    {account.isActive ? "Ativa" : "Inativa"}
                  </span>
                </td>
                <td className="py-2 whitespace-nowrap">
                  <button
                    onClick={() => startEdit(account)}
                    className="mr-3 text-xs font-medium text-gold hover:text-gold-soft hover:underline"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => toggleActive(account)}
                    className="mr-3 text-xs font-medium text-gold hover:text-gold-soft hover:underline"
                  >
                    {account.isActive ? "Desativar" : "Ativar"}
                  </button>
                  <button
                    onClick={() => handleDelete(account)}
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
    </div>
  );
}
