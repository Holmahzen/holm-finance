"use client";

import { useEffect, useState, type FormEvent } from "react";

type Counterparty = {
  id: string;
  name: string;
  document: string | null;
  type: "PESSOA_FISICA" | "PESSOA_JURIDICA" | "OUTRO";
  isOwnEntity: boolean;
};

const typeLabels: Record<Counterparty["type"], string> = {
  PESSOA_FISICA: "Pessoa física",
  PESSOA_JURIDICA: "Pessoa jurídica",
  OUTRO: "Outro",
};

export default function CounterpartiesPage() {
  const [items, setItems] = useState<Counterparty[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [type, setType] = useState<Counterparty["type"]>("OUTRO");
  const [isOwnEntity, setIsOwnEntity] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/counterparties");
    setItems(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await fetch("/api/counterparties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, document, type, isOwnEntity }),
    });
    setName("");
    setDocument("");
    setType("OUTRO");
    setIsOwnEntity(false);
    setSubmitting(false);
    await load();
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-3xl text-foreground">Contrapartes</h1>
        <p className="text-sm text-muted">
          Cadastro de pessoas e empresas usado para sugerir categorias e casar
          transações na conciliação.
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
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">CPF/CNPJ</label>
          <input
            value={document}
            onChange={(e) => setDocument(e.target.value)}
            className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Tipo</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as Counterparty["type"])}
            className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          >
            <option value="PESSOA_FISICA">Pessoa física</option>
            <option value="PESSOA_JURIDICA">Pessoa jurídica</option>
            <option value="OUTRO">Outro</option>
          </select>
        </div>
        <label className="flex items-center gap-2 pb-1.5 text-sm text-foreground">
          <input
            type="checkbox"
            checked={isOwnEntity}
            onChange={(e) => setIsOwnEntity(e.target.checked)}
            className="accent-gold"
          />
          Entidade própria
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-gold px-4 py-1.5 text-sm font-medium text-black transition hover:bg-gold-soft disabled:opacity-50"
        >
          {submitting ? "Salvando..." : "Adicionar contraparte"}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma contraparte cadastrada ainda.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="py-2 font-medium">Nome</th>
              <th className="py-2 font-medium">CPF/CNPJ</th>
              <th className="py-2 font-medium">Tipo</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-b border-border/50">
                <td className="py-2">
                  {c.name} {c.isOwnEntity && <span className="text-xs text-gold">(própria)</span>}
                </td>
                <td className="py-2">{c.document ?? "—"}</td>
                <td className="py-2">{typeLabels[c.type]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
