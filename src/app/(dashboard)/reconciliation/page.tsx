"use client";

import { Fragment, useEffect, useState, type FormEvent } from "react";
import { formatBRL } from "@/lib/format";

type Match = {
  id: string;
  status: "SUGGESTED" | "CONFIRMED" | "REJECTED";
  matchScore: number;
  matchReasons: string[];
  importedTransaction: {
    id: string;
    memo: string;
    amount: string;
    postedAt: string;
  };
  entry: {
    id: string;
    description: string;
    amount: string;
    dueDate: string;
  } | null;
};

type UnmatchedTransaction = {
  id: string;
  memo: string;
  amount: string;
  postedAt: string;
  trnType: "DEBIT" | "CREDIT";
};

type CategoryOption = { id: string; name: string; parentId: string | null };

type CategoryRule = {
  id: string;
  keyword: string;
  categoryId: string;
  category: { name: string };
};

type ApplyRulesResult = {
  checked: number;
  updated: number;
  breakdown: { categoryName: string; count: number }[];
};

export default function ReconciliationPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [unmatched, setUnmatched] = useState<UnmatchedTransaction[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [running, setRunning] = useState(false);
  const [creatingAll, setCreatingAll] = useState(false);

  const [ruleKeyword, setRuleKeyword] = useState("");
  const [ruleCategoryId, setRuleCategoryId] = useState("");
  const [savingRule, setSavingRule] = useState(false);

  const [applyingRules, setApplyingRules] = useState(false);
  const [applyResult, setApplyResult] = useState<ApplyRulesResult | null>(null);

  async function fetchMatchesAndUnmatched() {
    const [matchesRes, unmatchedRes] = await Promise.all([
      fetch("/api/reconciliation/matches"),
      fetch("/api/reconciliation/transactions"),
    ]);
    setMatches(await matchesRes.json());
    setUnmatched(await unmatchedRes.json());
  }

  async function fetchRules() {
    const rulesRes = await fetch("/api/category-rules");
    setRules(await rulesRes.json());
  }

  async function load() {
    setLoading(true);
    const [, categoriesRes] = await Promise.all([
      fetchMatchesAndUnmatched(),
      fetch("/api/categories"),
      fetchRules(),
    ]);
    setCategories(await categoriesRes.json());
    setLoading(false);
  }

  // Reload silencioso, usado depois de confirmar/rejeitar/criar lançamento —
  // essas ações só mudam sugestões e transações sem par, nunca categorias ou
  // regras, então não faz sentido refazer as 4 buscas a cada clique (isso é
  // o que fazia os botões parecerem lentos: 4 requisições pra atualizar uma
  // única linha). Não passa por `loading`, que esconderia a página inteira.
  async function refresh() {
    setRefreshing(true);
    await fetchMatchesAndUnmatched();
    setRefreshing(false);
  }

  // Reload só das regras, usado depois de adicionar/remover uma regra.
  async function refreshRules() {
    setRefreshing(true);
    await fetchRules();
    setRefreshing(false);
  }

  useEffect(() => {
    load();
  }, []);

  // Auto-preenche a categoria de transações que batem com alguma regra,
  // sem sobrescrever o que já foi escolhido manualmente.
  useEffect(() => {
    if (unmatched.length === 0 || rules.length === 0) return;
    setSelectedCategory((prev) => {
      const next = { ...prev };
      for (const t of unmatched) {
        if (next[t.id]) continue;
        const rule = rules.find((r) => t.memo.toUpperCase().includes(r.keyword.toUpperCase()));
        if (rule) next[t.id] = rule.categoryId;
      }
      return next;
    });
  }, [unmatched, rules]);

  async function handleAddRule(e: FormEvent) {
    e.preventDefault();
    if (!ruleKeyword || !ruleCategoryId) return;
    setSavingRule(true);
    await fetch("/api/category-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword: ruleKeyword, categoryId: ruleCategoryId }),
    });
    setRuleKeyword("");
    setRuleCategoryId("");
    setSavingRule(false);
    await refreshRules();
  }

  async function handleDeleteRule(id: string) {
    await fetch(`/api/category-rules/${id}`, { method: "DELETE" });
    await refreshRules();
  }

  async function handleApplyRulesToExisting() {
    if (
      !confirm(
        "Isso vai preencher a categoria de todos os lançamentos existentes que ainda estão sem categoria, sempre que a descrição bater com alguma regra. Lançamentos que já têm categoria não são alterados. Continuar?",
      )
    ) {
      return;
    }
    setApplyingRules(true);
    setApplyResult(null);
    const res = await fetch("/api/category-rules/apply", { method: "POST" });
    const body = await res.json();
    setApplyResult(body as ApplyRulesResult);
    setApplyingRules(false);
  }

  async function handleRun() {
    setRunning(true);
    await fetch("/api/reconciliation/run", { method: "POST" });
    setRunning(false);
    await refresh();
  }

  async function handleConfirm(id: string) {
    await fetch(`/api/reconciliation/matches/${id}/confirm`, { method: "POST" });
    await refresh();
  }

  async function handleReject(id: string) {
    await fetch(`/api/reconciliation/matches/${id}/reject`, { method: "POST" });
    await refresh();
  }

  async function handleCreateEntry(transactionId: string) {
    await fetch(`/api/reconciliation/transactions/${transactionId}/create-entry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId: selectedCategory[transactionId] || undefined }),
    });
    await refresh();
  }

  const withCategory = unmatched.filter((t) => selectedCategory[t.id]);

  async function handleCreateAllEntries() {
    if (
      !confirm(
        `Criar ${withCategory.length} lançamento(s) — só as transações que já têm categoria selecionada?`,
      )
    ) {
      return;
    }
    setCreatingAll(true);
    const items = withCategory.map((t) => ({
      transactionId: t.id,
      categoryId: selectedCategory[t.id],
    }));
    await fetch("/api/reconciliation/transactions/create-entries-bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    setCreatingAll(false);
    await refresh();
  }

  const suggested = matches.filter((m) => m.status === "SUGGESTED");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-foreground">Conciliação bancária</h1>
          <p className="text-sm text-muted">
            Sugestões automáticas de vínculo entre extrato importado e lançamentos.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {refreshing && <span className="text-xs text-muted">Atualizando...</span>}
          <button
            onClick={handleRun}
            disabled={running}
            className="rounded bg-gold px-4 py-1.5 text-sm font-medium text-black transition hover:bg-gold-soft disabled:opacity-50"
          >
            {running ? "Rodando..." : "Rodar conciliação"}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="font-serif text-xl text-foreground">Sugestões pendentes</h2>
            {suggested.length === 0 ? (
              <p className="text-sm text-muted">Nenhuma sugestão no momento.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted">
                    <th className="py-2 font-medium">Transação (extrato)</th>
                    <th className="py-2 font-medium">Lançamento</th>
                    <th className="py-2 font-medium">Score</th>
                    <th className="py-2 font-medium">Motivos</th>
                    <th className="py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {suggested.map((m) => (
                    <tr key={m.id} className="border-b border-border/50">
                      <td className="py-2">
                        {m.importedTransaction.memo.slice(0, 40)} —{" "}
                        {formatBRL(m.importedTransaction.amount)}
                      </td>
                      <td className="py-2">
                        {m.entry?.description} — {m.entry && formatBRL(m.entry.amount)}
                      </td>
                      <td className="py-2 text-gold">{(m.matchScore * 100).toFixed(0)}%</td>
                      <td className="py-2 text-xs text-muted">
                        {m.matchReasons.join(", ")}
                      </td>
                      <td className="py-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleConfirm(m.id)}
                            className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white transition hover:bg-emerald-500"
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={() => handleReject(m.id)}
                            className="rounded border border-border bg-surface-hover px-2 py-1 text-xs font-medium text-muted transition hover:text-foreground"
                          >
                            Rejeitar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl text-foreground">Regras de categorização automática</h2>
                <p className="text-sm text-muted">
                  Se o memo da transação contiver a palavra-chave, a categoria é preenchida sozinha em
                  "Transações sem par".
                </p>
              </div>
              <button
                onClick={handleApplyRulesToExisting}
                disabled={applyingRules || rules.length === 0}
                className="shrink-0 rounded border border-border bg-surface-hover px-4 py-1.5 text-sm font-medium text-foreground transition hover:border-gold disabled:opacity-50"
              >
                {applyingRules ? "Aplicando..." : "Reaplicar regras aos lançamentos existentes"}
              </button>
            </div>
            {applyResult && (
              <div className="rounded-lg border border-border bg-surface p-3 text-sm">
                <p>
                  {applyResult.checked} lançamento(s) sem categoria verificado(s), {" "}
                  <span className="font-medium text-emerald-400">
                    {applyResult.updated} categorizado(s) agora
                  </span>
                  .
                </p>
                {applyResult.breakdown.length > 0 && (
                  <ul className="mt-1 text-xs text-muted">
                    {applyResult.breakdown.map((b) => (
                      <li key={b.categoryName}>
                        {b.categoryName}: {b.count}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <form
              onSubmit={handleAddRule}
              className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4"
            >
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted">Se o memo contiver</label>
                <input
                  required
                  value={ruleKeyword}
                  onChange={(e) => setRuleKeyword(e.target.value)}
                  placeholder="Ex.: COMPRAS"
                  className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted">Categoria</label>
                <select
                  required
                  value={ruleCategoryId}
                  onChange={(e) => setRuleCategoryId(e.target.value)}
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
                disabled={savingRule}
                className="rounded bg-gold px-4 py-1.5 text-sm font-medium text-black transition hover:bg-gold-soft disabled:opacity-50"
              >
                {savingRule ? "Salvando..." : "Adicionar regra"}
              </button>
            </form>
            {rules.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {rules.map((r) => (
                  <span
                    key={r.id}
                    className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted"
                  >
                    "{r.keyword}" → {r.category.name}
                    <button
                      onClick={() => handleDeleteRule(r.id)}
                      className="text-red-400 hover:underline"
                    >
                      remover
                    </button>
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-xl text-foreground">Transações sem par</h2>
              {withCategory.length > 0 && (
                <button
                  onClick={handleCreateAllEntries}
                  disabled={creatingAll}
                  className="rounded bg-gold px-4 py-1.5 text-sm font-medium text-black transition hover:bg-gold-soft disabled:opacity-50"
                >
                  {creatingAll
                    ? "Criando..."
                    : `Criar lançamentos com categoria (${withCategory.length})`}
                </button>
              )}
            </div>
            {unmatched.length === 0 ? (
              <p className="text-sm text-muted">Nenhuma transação pendente.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted">
                    <th className="py-2 font-medium">Data</th>
                    <th className="py-2 font-medium">Memo</th>
                    <th className="py-2 font-medium">Valor</th>
                    <th className="py-2 font-medium">Categoria</th>
                    <th className="py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {unmatched.map((t) => (
                    <tr key={t.id} className="border-b border-border/50">
                      <td className="py-2">
                        {new Date(t.postedAt).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                      </td>
                      <td className="py-2">{t.memo}</td>
                      <td className="py-2">{formatBRL(t.amount)}</td>
                      <td className="py-2">
                        <select
                          value={selectedCategory[t.id] ?? ""}
                          onChange={(e) =>
                            setSelectedCategory((prev) => ({ ...prev, [t.id]: e.target.value }))
                          }
                          className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-gold focus:outline-none"
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
                      </td>
                      <td className="py-2">
                        <button
                          onClick={() => handleCreateEntry(t.id)}
                          className="text-xs font-medium text-gold hover:text-gold-soft hover:underline"
                        >
                          Criar lançamento
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
