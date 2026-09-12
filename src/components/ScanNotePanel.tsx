"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { formatBRL } from "@/lib/format";
import { formatAccessKey, formatCnpj, type ParsedAccessKey } from "@/domain/accessKey";

type NoteSummary = {
  issuerName: string;
  issuerDocument: string;
  issuedAt: string;
  total: number;
  direction: "SAIDA" | "ENTRADA_PROPRIA" | "ENTRADA_TERCEIRO";
  cancelledAt: string | null;
};

type ScanResult = { status: "importada" | "pendente"; key: ParsedAccessKey; note: NoteSummary | null };

type Pending = { accessKey: string; scannedAt: string; key: ParsedAccessKey | null };

const DIRECTION_LABEL: Record<NoteSummary["direction"], string> = {
  SAIDA: "venda emitida pela Holm",
  ENTRADA_PROPRIA: "devolução emitida pela Holm",
  ENTRADA_TERCEIRO: "nota de fornecedor",
};

function keyMonth(key: ParsedAccessKey | null): string {
  return key ? `${String(key.month).padStart(2, "0")}/${key.year}` : "—";
}

export function ScanNotePanel({ onChanged }: { onChanged?: () => void }) {
  const [value, setValue] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // O efeito so dispara a busca; o estado muda na resposta, nao no corpo do efeito.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/scanned-keys")
      .then((res) => res.json())
      .then((data: Pending[]) => {
        if (!cancelled) setPending(data);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadPending() {
    const res = await fetch("/api/scanned-keys");
    if (res.ok) setPending((await res.json()) as Pending[]);
  }

  async function send(raw: string) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/scanned-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: raw }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    setValue("");
    inputRef.current?.focus();
    if (!res.ok) {
      setResult(null);
      setError(body.error ?? "Não foi possível ler o código.");
      return;
    }
    setResult(body as ScanResult);
    await loadPending();
    onChanged?.();
  }

  /** Leitor sem Enter no fim: assim que os 44 dígitos chegam, registra sozinho. */
  function handleChange(next: string) {
    setValue(next);
    if (!busy && next.replace(/\D/g, "").length === 44) void send(next);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const raw = value.trim();
    if (raw) await send(raw);
  }

  async function forget(accessKey: string) {
    await fetch("/api/scanned-keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: accessKey }),
    });
    await loadPending();
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div>
        <h2 className="font-serif text-xl text-gold">Bipar nota impressa</h2>
        <p className="max-w-prose text-sm text-muted">
          Passe o leitor no código de barras comprido do DANFE, o que fica no alto da nota. O sistema lê a
          chave de acesso de 44 dígitos, confere o dígito verificador e diz se essa nota já foi importada. Se
          ainda não foi, ela entra na lista de pendentes abaixo — a chave sozinha não traz itens nem valores,
          que só vêm no XML.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="no-print flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          inputMode="numeric"
          placeholder="Bipe aqui ou digite os 44 dígitos"
          className="w-96 max-w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:font-sans placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={busy || value.trim() === ""}
          className="rounded-md border border-gold px-4 py-2 text-sm text-gold transition hover:bg-gold hover:text-background disabled:cursor-not-allowed disabled:border-border disabled:text-muted disabled:hover:bg-transparent disabled:hover:text-muted"
        >
          {busy ? "Lendo..." : "Registrar"}
        </button>
        <span className="text-xs text-muted">{value.replace(/\D/g, "").length} de 44 dígitos</span>
      </form>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {result && (
        <div
          className={`rounded-md border p-3 text-sm ${
            result.status === "importada"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : "border-amber-400/40 bg-amber-400/10 text-amber-100"
          }`}
        >
          <p className="font-medium">
            {result.status === "importada"
              ? "Nota já importada"
              : "Nota ainda sem XML — guardada como pendente"}
          </p>
          <p className="mt-1 font-mono text-xs">{formatAccessKey(result.key.key)}</p>
          <p className="mt-1 text-xs">
            {result.key.modelName} · série {result.key.series} · nº {result.key.number} ·{" "}
            {keyMonth(result.key)} · {result.key.ufName} · emitente {formatCnpj(result.key.issuerDocument)}
          </p>
          {result.note && (
            <p className="mt-1 text-xs">
              {result.note.issuerName} · {DIRECTION_LABEL[result.note.direction]} ·{" "}
              {formatBRL(result.note.total)} · emitida em{" "}
              {new Date(result.note.issuedAt).toLocaleDateString("pt-BR")}
              {result.note.cancelledAt && " · NOTA CANCELADA"}
            </p>
          )}
        </div>
      )}

      {pending.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-medium tracking-wide text-muted uppercase">
            Notas bipadas esperando o XML ({pending.length})
          </h3>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-2xl text-sm">
              <thead className="bg-surface-hover">
                <tr className="text-xs tracking-wide text-muted uppercase">
                  <th className="px-3 py-2 text-left font-medium">Emitente (CNPJ)</th>
                  <th className="px-3 py-2 text-left font-medium">Documento</th>
                  <th className="px-3 py-2 text-left font-medium">Chave</th>
                  <th className="px-3 py-2 text-left font-medium">Bipada em</th>
                  <th className="no-print px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {pending.map((p) => (
                  <tr key={p.accessKey} className="border-t border-border">
                    <td className="px-3 py-2 text-foreground">{formatCnpj(p.key?.issuerDocument ?? "")}</td>
                    <td className="px-3 py-2 text-muted">
                      {p.key?.modelName} · nº {p.key?.number} · {keyMonth(p.key)}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-muted">{formatAccessKey(p.accessKey)}</td>
                    <td className="px-3 py-2 text-muted">{new Date(p.scannedAt).toLocaleDateString("pt-BR")}</td>
                    <td className="no-print px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => forget(p.accessKey)}
                        className="text-xs text-muted underline underline-offset-2 hover:text-red-400"
                      >
                        remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted">
            Peça o XML dessas notas ao fornecedor e importe no botão acima: a nota some desta lista sozinha.
          </p>
        </div>
      )}
    </section>
  );
}
