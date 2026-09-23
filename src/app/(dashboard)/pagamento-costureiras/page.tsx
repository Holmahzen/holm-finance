"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { formatBRL } from "@/lib/format";

type Counterparty = { id: string; name: string; isCostureira: boolean };
type Category = { id: string; name: string };
type Account = { id: string; name: string };

type Servico = {
  id: string;
  date: string;
  amount: string;
  description: string | null;
};

type Pendencia = {
  entryId: string | null;
  dueDate: string | null;
  servicos: Servico[];
};

type Entry = {
  id: string;
  description: string;
  amount: string;
  paidAmount: string | null;
  paidAt: string | null;
};

function todayLocalDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function isOverdue(dueDate: string) {
  return new Date(dueDate) < new Date(todayLocalDateString());
}

export default function PagamentoCostureirasPage() {
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [costuraCategoryId, setCosturaCategoryId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const [counterpartyId, setCounterpartyId] = useState("");

  // lançar serviço
  const [servicoData, setServicoData] = useState(todayLocalDateString());
  const [servicoValor, setServicoValor] = useState("");
  const [servicoDescricao, setServicoDescricao] = useState("");
  const [servicoDueDate, setServicoDueDate] = useState("");
  const [savingServico, setSavingServico] = useState(false);
  const [servicoError, setServicoError] = useState<string | null>(null);

  // pagar
  const [pagamentoData, setPagamentoData] = useState(todayLocalDateString());
  const [bankAccountId, setBankAccountId] = useState("");
  const [pagando, setPagando] = useState(false);
  const [pagamentoError, setPagamentoError] = useState<string | null>(null);
  const [pagamentoSuccess, setPagamentoSuccess] = useState<string | null>(null);

  // editar vencimento
  const [editingDueDate, setEditingDueDate] = useState(false);
  const [editDueDateValue, setEditDueDateValue] = useState("");

  const [pendencia, setPendencia] = useState<Pendencia | null>(null);
  const [historico, setHistorico] = useState<Entry[] | null>(null);
  const [loadingPendentes, setLoadingPendentes] = useState(false);

  const costureiras = useMemo(() => counterparties.filter((c) => c.isCostureira), [counterparties]);
  const selectedCostureira = costureiras.find((c) => c.id === counterpartyId);
  const totalPendente = useMemo(
    () => (pendencia?.servicos ?? []).reduce((sum, s) => sum + Number(s.amount), 0),
    [pendencia],
  );

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

  async function loadPendentesEHistorico(id: string) {
    if (!id) {
      setPendencia(null);
      setHistorico(null);
      return;
    }
    setLoadingPendentes(true);
    const [pendenciaRes, historicoRes] = await Promise.all([
      fetch(`/api/costureira-servicos?counterpartyId=${id}`),
      costuraCategoryId
        ? fetch(`/api/entries?counterpartyId=${id}&categoryId=${costuraCategoryId}&status=PAID`)
        : Promise.resolve(null),
    ]);
    setPendencia(await pendenciaRes.json());
    if (historicoRes) {
      const entries: Entry[] = await historicoRes.json();
      entries.sort((a, b) => (b.paidAt ?? "").localeCompare(a.paidAt ?? ""));
      setHistorico(entries);
    }
    setLoadingPendentes(false);
  }

  useEffect(() => {
    setEditingDueDate(false);
    loadPendentesEHistorico(counterpartyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counterpartyId, costuraCategoryId]);

  async function handleAddServico(e: FormEvent) {
    e.preventDefault();
    setSavingServico(true);
    setServicoError(null);
    const res = await fetch("/api/costureira-servicos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        counterpartyId,
        date: servicoData,
        amount: servicoValor,
        description: servicoDescricao || undefined,
        dueDate: !pendencia?.entryId ? servicoDueDate : undefined,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setServicoError(typeof body.error === "string" ? body.error : "Não foi possível lançar o serviço.");
      setSavingServico(false);
      return;
    }
    setServicoValor("");
    setServicoDescricao("");
    setServicoDueDate("");
    setSavingServico(false);
    await loadPendentesEHistorico(counterpartyId);
  }

  async function handleRemoveServico(id: string) {
    if (!confirm("Excluir esse serviço lançado?")) return;
    await fetch(`/api/costureira-servicos/${id}`, { method: "DELETE" });
    await loadPendentesEHistorico(counterpartyId);
  }

  function startEditDueDate() {
    setEditDueDateValue(pendencia?.dueDate?.slice(0, 10) ?? "");
    setEditingDueDate(true);
  }

  async function saveDueDate() {
    await fetch("/api/costureira-servicos/due-date", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ counterpartyId, dueDate: editDueDateValue }),
    });
    setEditingDueDate(false);
    await loadPendentesEHistorico(counterpartyId);
  }

  async function handlePagarTudo() {
    setPagando(true);
    setPagamentoError(null);
    setPagamentoSuccess(null);
    const res = await fetch("/api/costureira-servicos/pagar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ counterpartyId, bankAccountId, paidAt: pagamentoData }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setPagamentoError(typeof body.error === "string" ? body.error : "Não foi possível pagar.");
      setPagando(false);
      return;
    }
    const result = await res.json();
    setPagamentoSuccess(
      `Pago ${formatBRL(result.total)} (${result.count} serviço${result.count > 1 ? "s" : ""}) pra ${selectedCostureira?.name}.`,
    );
    setPagando(false);
    await loadPendentesEHistorico(counterpartyId);
  }

  if (loading) return <p className="text-sm text-muted">Carregando...</p>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl text-foreground">Pagamento de Costureiras</h1>
        <p className="max-w-prose text-sm text-muted">
          Lança cada serviço enviado (data + valor), sem gerar cobrança na hora — vai acumulando. O
          primeiro serviço de uma quinzena já cria a previsão no Fluxo de Caixa, com o vencimento que
          você escolher. Quando fechar a quinzena, clique em &quot;Pagar tudo&quot; pra virar um único
          lançamento pago. Pra aparecer aqui, marque a contraparte como costureira em{" "}
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
        <>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted">Costureira</label>
            <select
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

          {counterpartyId && (
            <>
              <form
                onSubmit={handleAddServico}
                className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4"
              >
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted">Data do serviço</label>
                  <input
                    required
                    type="date"
                    value={servicoData}
                    onChange={(e) => setServicoData(e.target.value)}
                    className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted">Valor (R$)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min={0}
                    value={servicoValor}
                    onChange={(e) => setServicoValor(e.target.value)}
                    className="w-32 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted">Descrição (opcional)</label>
                  <input
                    value={servicoDescricao}
                    onChange={(e) => setServicoDescricao(e.target.value)}
                    placeholder="Ex.: lote de 40 camisetas"
                    className="w-56 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
                  />
                </div>
                {pendencia && !pendencia.entryId && (
                  <div className="flex flex-col gap-1">
                    <label
                      className="text-xs font-medium text-muted"
                      title="Primeiro serviço dessa quinzena — essa data já entra na previsão do Fluxo de Caixa. Pode ser uma data passada, se a quinzena já fechou e só falta pagar."
                    >
                      Vencimento previsto
                    </label>
                    <input
                      required
                      type="date"
                      value={servicoDueDate}
                      onChange={(e) => setServicoDueDate(e.target.value)}
                      className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
                    />
                  </div>
                )}
                <button
                  type="submit"
                  disabled={savingServico}
                  className="rounded bg-gold px-4 py-1.5 text-sm font-medium text-black transition hover:bg-gold-soft disabled:opacity-50"
                >
                  {savingServico ? "Lançando..." : "Lançar serviço"}
                </button>
                {servicoError && <p className="w-full text-sm text-red-400">{servicoError}</p>}
              </form>

              <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-lg text-foreground">
                      Pendente — {selectedCostureira?.name}
                    </h2>
                    <p className="text-2xl font-serif text-gold">{formatBRL(totalPendente)}</p>
                    {pendencia?.dueDate && (
                      <p className="mt-1 text-xs text-muted">
                        {editingDueDate ? (
                          <span className="inline-flex items-center gap-2">
                            Vencimento:
                            <input
                              type="date"
                              value={editDueDateValue}
                              onChange={(e) => setEditDueDateValue(e.target.value)}
                              className="rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground focus:border-gold focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={saveDueDate}
                              className="font-medium text-gold hover:underline"
                            >
                              Salvar
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingDueDate(false)}
                              className="text-muted hover:underline"
                            >
                              Cancelar
                            </button>
                          </span>
                        ) : (
                          <span className={isOverdue(pendencia.dueDate) ? "text-red-400" : ""}>
                            Vencimento: {formatDate(pendencia.dueDate)}
                            {isOverdue(pendencia.dueDate) && " (atrasado)"}{" "}
                            <button
                              type="button"
                              onClick={startEditDueDate}
                              className="ml-1 text-gold hover:underline"
                            >
                              editar
                            </button>
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>

                {loadingPendentes ? (
                  <p className="text-sm text-muted">Carregando...</p>
                ) : pendencia && pendencia.servicos.length > 0 ? (
                  <>
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-border text-muted">
                          <th className="py-2 font-medium">Data</th>
                          <th className="py-2 font-medium">Descrição</th>
                          <th className="py-2 font-medium">Valor</th>
                          <th className="py-2 font-medium"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendencia.servicos.map((s) => (
                          <tr key={s.id} className="border-b border-border/50">
                            <td className="py-2">{formatDate(s.date)}</td>
                            <td className="py-2 text-muted">{s.description || "—"}</td>
                            <td className="py-2">{formatBRL(s.amount)}</td>
                            <td className="py-2 text-right">
                              <button
                                onClick={() => handleRemoveServico(s.id)}
                                className="text-xs font-medium text-red-400 hover:underline"
                              >
                                Excluir
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted">Data do pagamento</label>
                        <input
                          type="date"
                          value={pagamentoData}
                          onChange={(e) => setPagamentoData(e.target.value)}
                          className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted">Pago de qual conta</label>
                        <select
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
                      <button
                        onClick={handlePagarTudo}
                        disabled={pagando || !bankAccountId}
                        className="rounded bg-gold px-4 py-1.5 text-sm font-medium text-black transition hover:bg-gold-soft disabled:opacity-50"
                      >
                        {pagando ? "Pagando..." : `Pagar tudo (${formatBRL(totalPendente)})`}
                      </button>
                    </div>
                    {pagamentoError && <p className="text-sm text-red-400">{pagamentoError}</p>}
                    {pagamentoSuccess && <p className="text-sm text-emerald-400">{pagamentoSuccess}</p>}
                  </>
                ) : (
                  <p className="text-sm text-muted">Nenhum serviço pendente — lance um acima.</p>
                )}
              </div>

              {historico && historico.length > 0 && (
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
            </>
          )}
        </>
      )}
    </div>
  );
}
