"use client";

import { useEffect, useState, type FormEvent } from "react";
import { formatBRL } from "@/lib/format";

type Account = { id: string; name: string };

type Batch = {
  id: string;
  source: "OFX" | "XLSX";
  fileName: string;
  transactionCount: number;
  ledgerBalance: string | null;
  ledgerBalanceDate: string | null;
  importedAt: string;
  bankAccount: { name: string };
};

type OfxResult = {
  alreadyImported: boolean;
  totalTransactions: number;
  newTransactions: number;
  duplicateTransactions: number;
  balanceCheck: { expectedDelta: string | null; actualDelta: string; matches: boolean | null };
};

type ExcelResult = {
  alreadyImported: boolean;
  format: "mercado_pago" | "generic";
  totalTransactions: number;
  newTransactions: number;
  duplicateTransactions: number;
};

const formatLabels: Record<ExcelResult["format"], string> = {
  mercado_pago: "Mercado Pago (Entrada/Saída)",
  generic: "Genérico (Valor)",
};

function UploadForm({
  title,
  description,
  accept,
  accounts,
  endpoint,
  onImported,
  children,
}: {
  title: string;
  description: string;
  accept: string;
  accounts: Account[];
  endpoint: string;
  onImported: () => void;
  children: (result: unknown, error: string | null) => React.ReactNode;
}) {
  const [bankAccountId, setBankAccountId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file || !bankAccountId) return;
    setSubmitting(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("bankAccountId", bankAccountId);

    const res = await fetch(endpoint, { method: "POST", body: formData });
    const body = await res.json();

    if (!res.ok) {
      setError(typeof body.error === "string" ? body.error : JSON.stringify(body.error));
    } else {
      setResult(body);
      setFile(null);
      onImported();
    }
    setSubmitting(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="font-serif text-xl text-foreground">{title}</h2>
        <p className="text-sm text-muted">{description}</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Conta</label>
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
          <label className="text-xs font-medium text-muted">Arquivo</label>
          <input
            required
            type="file"
            accept={accept}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm text-foreground file:mr-2 file:rounded file:border-0 file:bg-gold file:px-3 file:py-1 file:text-black"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-gold px-4 py-1.5 text-sm font-medium text-black transition hover:bg-gold-soft disabled:opacity-50"
        >
          {submitting ? "Importando..." : "Importar"}
        </button>
      </form>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {result != null && (
        <div className="rounded-lg border border-border bg-surface p-4 text-sm">
          {children(result, error)}
        </div>
      )}
    </div>
  );
}

export default function ImportsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  async function load() {
    const [accountsRes, batchesRes] = await Promise.all([
      fetch("/api/accounts"),
      fetch("/api/imports/ofx"),
    ]);
    setAccounts(await accountsRes.json());
    setBatches(await batchesRes.json());
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="font-serif text-3xl text-foreground">Importação de extratos</h1>
        <p className="text-sm text-muted">
          Envie extratos bancários (.ofx) ou planilhas (.xlsx) para importar as transações.
        </p>
      </div>

      <UploadForm
        title="Extrato OFX"
        description="Arquivo .ofx exportado direto do banco (ex.: Sicredi)."
        accept=".ofx"
        accounts={accounts}
        endpoint="/api/imports/ofx"
        onImported={load}
      >
        {(result) => {
          const r = result as OfxResult;
          return r.alreadyImported ? (
            <p>Este arquivo já havia sido importado antes. Nenhuma transação nova.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              <li>Total de transações no arquivo: {r.totalTransactions}</li>
              <li>Novas: {r.newTransactions}</li>
              <li>Duplicadas (já existentes): {r.duplicateTransactions}</li>
              {r.balanceCheck.matches !== null && (
                <li>
                  Checagem de saldo: {r.balanceCheck.matches ? "✓ bate" : "⚠ divergente"}{" "}
                  (esperado {r.balanceCheck.expectedDelta}, calculado {r.balanceCheck.actualDelta})
                </li>
              )}
            </ul>
          );
        }}
      </UploadForm>

      <UploadForm
        title="Planilha Excel"
        description="Formato Mercado Pago (Data, Descrição, Entrada, Saída, Contraparte...) ou genérico (Data, Descrição, Valor, Tipo)."
        accept=".xlsx,.xls"
        accounts={accounts}
        endpoint="/api/imports/excel"
        onImported={load}
      >
        {(result) => {
          const r = result as ExcelResult;
          return r.alreadyImported ? (
            <p>Este arquivo já havia sido importado antes. Nenhuma transação nova.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              <li>Formato detectado: {formatLabels[r.format]}</li>
              <li>Total de transações no arquivo: {r.totalTransactions}</li>
              <li>Novas: {r.newTransactions}</li>
              <li>Duplicadas (já existentes): {r.duplicateTransactions}</li>
            </ul>
          );
        }}
      </UploadForm>

      {batches.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-serif text-xl text-foreground">Importações realizadas</h2>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="py-2 font-medium">Origem</th>
                <th className="py-2 font-medium">Arquivo</th>
                <th className="py-2 font-medium">Conta</th>
                <th className="py-2 font-medium">Transações</th>
                <th className="py-2 font-medium">Saldo final</th>
                <th className="py-2 font-medium">Data do saldo</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="border-b border-border/50">
                  <td className="py-2">{b.source === "OFX" ? "OFX" : "Excel"}</td>
                  <td className="py-2">{b.fileName}</td>
                  <td className="py-2">{b.bankAccount.name}</td>
                  <td className="py-2">{b.transactionCount}</td>
                  <td className="py-2">
                    {b.ledgerBalance ? formatBRL(b.ledgerBalance) : "—"}
                  </td>
                  <td className="py-2">
                    {b.ledgerBalanceDate
                      ? new Date(b.ledgerBalanceDate).toLocaleDateString("pt-BR", {
                          timeZone: "UTC",
                        })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
