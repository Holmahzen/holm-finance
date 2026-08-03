"use client";

import { useEffect, useState, type FormEvent } from "react";
import { formatBRL } from "@/lib/format";
import { PeriodFilter } from "@/components/PeriodFilter";

type Sale = {
  id: string;
  orderId: string;
  saleDate: string;
  sku: string;
  productName: string;
  channel: string;
  shippingModality: string | null;
  quantity: number;
  grossRevenue: string;
  netRevenue: string;
  customerName: string | null;
  status: string;
};

type SalesReport = {
  period: { year: number; month: number };
  totalGrossRevenue: number;
  totalNetRevenue: number;
  totalQuantity: number;
  salesCount: number;
  sales: Sale[];
};

type ImportBatch = {
  id: string;
  fileName: string;
  rowCount: number;
  importedCount: number;
  duplicateCount: number;
  importedAt: string;
};

type ImportResult = {
  alreadyImported: boolean;
  totalRows: number;
  skippedRows: number;
  newSales: number;
  duplicateSales: number;
};

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
      <span className="text-xs font-medium tracking-wide text-muted uppercase">{label}</span>
      <span className="font-serif text-2xl text-gold">{value}</span>
    </div>
  );
}

const now = new Date();

export default function VendasPage() {
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState<SalesReport | null>(null);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(true);

  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [reportRes, batchesRes] = await Promise.all([
      fetch(`/api/sales?year=${year}&month=${month}`),
      fetch("/api/imports/sales"),
    ]);
    setReport(await reportRes.json());
    setBatches(await batchesRes.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setSubmitting(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/imports/sales", { method: "POST", body: formData });
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }

    if (!res.ok) {
      const message =
        body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string"
          ? (body as { error: string }).error
          : `Falha ao importar (HTTP ${res.status}). Tente novamente.`;
      setError(message);
    } else {
      setResult(body as ImportResult);
      setFile(null);
      await load();
    }
    setSubmitting(false);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-3xl text-foreground">Vendas</h1>
        <p className="text-sm text-muted">
          Importe a planilha de pedidos do Mercado Turbo para atualizar receita, quantidade e
          status das vendas. Pedidos já importados (mesmo número) nunca são duplicados.
        </p>
      </div>

      <form
        onSubmit={handleUpload}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Planilha do Mercado Turbo (.xlsx)</label>
          <input
            required
            type="file"
            accept=".xlsx,.xls"
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
      {result && (
        <div className="rounded-lg border border-border bg-surface p-4 text-sm">
          {result.alreadyImported ? (
            <p>Este arquivo já havia sido importado antes. Nenhuma venda nova.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              <li>Linhas na planilha: {result.totalRows}</li>
              {result.skippedRows > 0 && (
                <li>Ignoradas por falta de dado essencial (pedido/SKU/data): {result.skippedRows}</li>
              )}
              <li className="text-emerald-400">Vendas novas importadas: {result.newSales}</li>
              <li>Já existentes (puladas): {result.duplicateSales}</li>
            </ul>
          )}
        </div>
      )}

      <PeriodFilter
        year={year}
        month={month}
        years={[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]}
        onChange={(y, m) => {
          setYear(y);
          setMonth(m);
        }}
      />

      {loading || !report ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Receita bruta" value={formatBRL(report.totalGrossRevenue)} />
            <StatCard label="Receita líquida" value={formatBRL(report.totalNetRevenue)} />
            <StatCard label="Quantidade vendida" value={String(report.totalQuantity)} />
            <StatCard label="Nº de vendas" value={String(report.salesCount)} />
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
            <h2 className="font-serif text-lg text-foreground">Vendas do período</h2>
            {report.sales.length === 0 ? (
              <p className="text-sm text-muted">Nenhuma venda importada para este período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted">
                      <th className="py-1.5 font-medium">Data</th>
                      <th className="py-1.5 font-medium">Pedido</th>
                      <th className="py-1.5 font-medium">SKU</th>
                      <th className="py-1.5 font-medium">Produto</th>
                      <th className="py-1.5 font-medium">Canal</th>
                      <th className="py-1.5 font-medium">Envio</th>
                      <th className="py-1.5 font-medium">Qtd.</th>
                      <th className="py-1.5 font-medium">Bruta</th>
                      <th className="py-1.5 font-medium">Líquida</th>
                      <th className="py-1.5 font-medium">Cliente</th>
                      <th className="py-1.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.sales.map((s) => (
                      <tr key={s.id} className="border-b border-border/50">
                        <td className="py-1.5">
                          {new Date(s.saleDate).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                        </td>
                        <td className="py-1.5">{s.orderId}</td>
                        <td className="py-1.5">{s.sku}</td>
                        <td className="py-1.5 max-w-[220px] truncate" title={s.productName}>
                          {s.productName}
                        </td>
                        <td className="py-1.5">{s.channel}</td>
                        <td className="py-1.5">{s.shippingModality ?? "—"}</td>
                        <td className="py-1.5">{s.quantity}</td>
                        <td className="py-1.5">{formatBRL(s.grossRevenue)}</td>
                        <td className="py-1.5">{formatBRL(s.netRevenue)}</td>
                        <td className="py-1.5">{s.customerName ?? "—"}</td>
                        <td className="py-1.5">{s.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {batches.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-serif text-xl text-foreground">Importações realizadas</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2 font-medium">Arquivo</th>
                  <th className="py-2 font-medium">Linhas</th>
                  <th className="py-2 font-medium">Novas</th>
                  <th className="py-2 font-medium">Duplicadas</th>
                  <th className="py-2 font-medium">Importado em</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="border-b border-border/50">
                    <td className="py-2">{b.fileName}</td>
                    <td className="py-2">{b.rowCount}</td>
                    <td className="py-2">{b.importedCount}</td>
                    <td className="py-2">{b.duplicateCount}</td>
                    <td className="py-2">
                      {new Date(b.importedAt).toLocaleString("pt-BR", { timeZone: "UTC" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
