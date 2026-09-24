"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { safeNextPath } from "@/lib/auth-path";

function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      window.location.assign(safeNextPath(params.get("next")));
      return;
    }
    const body = await res.json().catch(() => ({}));
    setError(typeof body.error === "string" ? body.error : "Não foi possível entrar.");
    setLoading(false);
  }

  const inputClass =
    "rounded border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none";

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-border bg-surface p-6">
      <div>
        <h1 className="font-serif text-2xl tracking-wide text-gold">
          Holm <span className="text-foreground">Finance</span>
        </h1>
        <p className="text-sm text-muted">Acesso restrito.</p>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-xs font-medium text-muted">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-xs font-medium text-muted">
          Senha
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded bg-gold px-4 py-2 text-sm font-medium text-black transition hover:bg-gold-soft disabled:opacity-50"
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
