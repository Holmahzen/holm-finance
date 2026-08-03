"use client";

import { Fragment, useEffect, useState, type FormEvent } from "react";

type Category = {
  id: string;
  name: string;
  type: "PAYABLE" | "RECEIVABLE" | null;
  parentId: string | null;
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [type, setType] = useState<"" | "PAYABLE" | "RECEIVABLE">("");
  const [parentId, setParentId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/categories");
    setCategories(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const topLevel = categories.filter((c) => !c.parentId);
  const childrenOf = (id: string) => categories.filter((c) => c.parentId === id);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type: type || undefined, parentId: parentId || undefined }),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(typeof body.error === "string" ? body.error : "Não foi possível criar a categoria.");
    } else {
      setName("");
      setType("");
      setParentId("");
      await load();
    }
    setSubmitting(false);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-3xl text-foreground">Categorias</h1>
        <p className="text-sm text-muted">
          Taxonomia usada para classificar lançamentos e contrapartes. Categorias principais podem
          conter subcategorias.
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
            placeholder="Ex.: Aluguel, Comissões"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Tipo</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
            className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          >
            <option value="">Ambos</option>
            <option value="PAYABLE">A pagar</option>
            <option value="RECEIVABLE">A receber</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Categoria pai (opcional)</label>
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          >
            <option value="">— Categoria principal —</option>
            {topLevel.map((c) => (
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
          {submitting ? "Salvando..." : "Adicionar categoria"}
        </button>
      </form>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : categories.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma categoria cadastrada ainda.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="py-2 font-medium">Nome</th>
              <th className="py-2 font-medium">Tipo</th>
            </tr>
          </thead>
          <tbody>
            {topLevel.map((parent) => (
              <Fragment key={parent.id}>
                <tr className="border-b border-border/50">
                  <td className="py-2">{parent.name}</td>
                  <td className="py-2">
                    {parent.type === "PAYABLE"
                      ? "A pagar"
                      : parent.type === "RECEIVABLE"
                        ? "A receber"
                        : "Ambos"}
                  </td>
                </tr>
                {childrenOf(parent.id).map((child) => (
                  <tr key={child.id} className="border-b border-border/50">
                    <td className="py-2 pl-6 text-muted">└ {child.name}</td>
                    <td className="py-2">
                      {child.type === "PAYABLE"
                        ? "A pagar"
                        : child.type === "RECEIVABLE"
                          ? "A receber"
                          : "Ambos"}
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
