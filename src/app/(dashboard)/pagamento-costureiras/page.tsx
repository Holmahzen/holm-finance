"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { formatBRL } from "@/lib/format";

type Counterparty = { id: string; name: string; isCostureira: boolean };
type Category = { id: string; name: string };
type Account = { id: string; name: string };

type Entry = {
  id: string;
  description: string;
  amount: string;
  paidAmount: string | null;
  paidAt: string | null;
  status: string;
};

function todayLocalDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export default function PagamentoCostureirasPage() {
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [costuraCategoryId, setCosturaCategoryId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const [counterpartyId, setCounterpartyId] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(todayLocalDateString());
  const [bankAccountId, setBankAccountId] = useState("");
  const [notas, setNotas] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [historico, setHistorico] = useState<Entry[] | null>(null);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  const costureiras = useMemo(() => counterparties.filter((c) => c.isCostureira), [counterparties]);

  async function loadBase() {
    setLoading(true);
    const [counterpartiesRes, categoriesRes, accountsRes] = await Promise.all([
      fetch("/api/counterparties"),
      fetch("/api/categories"),
      fetch("/api/accounts"),
    ]);
    setCounterparties(await counterpartiesRes.json());
    const categories: Category[] = await categoriesRes.json();
    setCosturaCategoryId(categories.find((c) => c.name === "Costura")?.id ?? null);
    setAccounts(await accountsRes.json());
    setLoading(false);
  }

  useEffect(() => {
    loadBase();
  }, []);

  async function loadHistorico(id: string) {
    if (!id || !costuraCategoryId) {
      setHistorico(null);
      return;
    }
    setLoadingHistorico(true);
    const res = await fetch(
      `/api/entries?counterpartyId=${id}&categoryId=${costuraCategoryId}&status=PAID`,
    );
    const entries: Entry[] = await res.json();
    entries.sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""));
    setHistorico(entries);
    setLoadingHistorico(false);
  }

  useEffect(() => {
    loadHistorico(counterpartyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counterpartyId, costuraCategoryId]);

  const selectedCostureira = costureiras.find((c) => c.id === counterpartyId);
  const ultimoPagamento = historico?.[0] ?? null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!costuraCategoryId) {
      setError("Categoria \"Costura\" não encontrada em Categorias.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const createRes = await fetch("/api/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "PAYABLE",
        description: `Costura - ${selectedCostureira?.name ?? ""}`,
        amount: valor,
        dueDate: data,
        categoryId: costuraCategoryId,
        counterpartyId,
        notes: notas || undefined,
      }),
    });
    if (!createRes.ok) {
      const body = await createRes.json().catch(() => ({}));
      setError(typeof body.error === "string" ? body.error : "Não foi possível lançar o pagamento.");
      setSubmitting(false);
      return;
    }
    const created = await createRes.json();

    const payRes = await fetch(`/api/entries/${created.id}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bankAccountId, paidAmount: valor, paidAt: data }),
    });
    if (!payRes.ok) {
      const body = await payRes.json().catch(() => ({}));
      setError(
        typeof body.error === "string"
          ? `Lançamento criado, mas não foi possível marcar como pago: ${body.error}`
          : "Lançamento criado, mas não foi possível marcar como pago.",
      );
      setSubmitting(false);
      return;
    }

    setSuccess(`Pagamento de ${formatBRL(valor)} pra ${selectedCostureira?.name} registrado.`);
    setValor("");
    setNotas("");
    setSubmitting(false);
    await loadHistorico(counterpartyId);
  }

  if (loading) return <p className="text-sm text-muted">Carregando...</p>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl text-foreground">Pagamento de Costureiras</h1>
        <p className="max-w-prose text-sm text-muted">
          Lança o valor pago pra cada costureira, uma de cada vez, sem depender de nota fiscal — vira
          um lançamento pago de verdade, categorizado em &quot;Costura&quot;. Pra aparecer aqui, marque a
          contraparte como costureira em{" "}
          <a href="/counterparties" className="text-gold hover:underline">
            Contrapartes
          </a>
          .
        </p>
      </div>

      {costureiras.length === 0 ? (
        <p className="text-sm text-muted">
          Nenhuma contraparte marcada como costureira ainda. Marque em{" "}
          <a href="/counterparties" className="text-gold hover:underline">
            Contrapartes
          </a>
          .
        </p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4"
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted">Costureira</label>
              <select
                required
                value={counterpartyId}
                onChange={(e) => setCounterpartyId(e.target.value)}
                className="w-56 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
              >
                <option value="">Selecione...</option>
                {costureiras.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted">Valor (R$)</label>
              <input
                required
                type="number"
                step="0.01"
                min={0}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="w-32 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted">Data</label>
              <input
                required
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted">Pago de qual conta</label>
              <select
                required
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
                className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
              >
                <option value="">Selecione...</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted">Observação (opcional)</label>
              <input
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Ex.: quinzena 1-15/09"
                className="w-48 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-gold px-4 py-1.5 text-sm font-medium text-black transition hover:bg-gold-soft disabled:opacity-50"
            >
              {submitting ? "Registrando..." : "Registrar pagamento"}
            </button>
          </div>

          {counterpartyId && (
            <div className="text-xs text-muted">
              {loadingHistorico ? (
                "Carregando histórico..."
              ) : ultimoPagamento ? (
                <>
                  Último pagamento pra {selectedCostureira?.name}:{" "}
                  <span className="text-foreground">
                    {formatBRL(ultimoPagamento.paidAmount ?? ultimoPagamento.amount)}
                  </span>{" "}
                  em{" "}
                  <span className="text-foreground">
                    {ultimoPagamento.paidAt ? formatDate(ultimoPagamento.paidAt) : "—"}
                  </span>
                </>
              ) : (
                <>Nenhum pagamento registrado ainda pra {selectedCostureira?.name}.</>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
          {success && <p className="text-sm text-emerald-400">{success}</p>}
        </form>
      )}

      {counterpartyId && historico && historico.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
          <h2 className="font-serif text-lg text-foreground">
            Histórico de pagamentos — {selectedCostureira?.name}
          </h2>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 font-medium">Data</th>
                <th className="py-2 font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {historico.map((h) => (
                <tr key={h.id} className="border-b border-border/50">
                  <td className="py-2">{h.paidAt ? formatDate(h.paidAt) : "—"}</td>
                  <td className="py-2">{formatBRL(h.paidAmount ?? h.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
