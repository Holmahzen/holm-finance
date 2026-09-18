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

type ModalityBreakdown = {
  modality: string;
  count: number;
  quantity: number;
  grossRevenue: number;
  netRevenue: number;
};

type SalesReport = {
  period: { year: number; month: number };
  totalGrossRevenue: number;
  totalNetRevenue: number;
  totalQuantity: number;
  salesCount: number;
  sales: Sale[];
};

type ModalityReport = {
  totalGrossRevenue: number;
  totalNetRevenue: number;
  totalQuantity: number;
  salesCount: number;
  byModality: ModalityBreakdown[];
  flexExpectedInvoice: number;
};

const FLEX_COST_PER_PACKAGE = 12.99;

function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Quinzena corrente: 01-15 ou 16-fim do mês, conforme o dia de hoje — mesmo
 * corte que a transportadora usa pra fechar a fatura do Flex. */
function currentFortnight(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (now.getDate() <= 15) {
    return { from: toDateInputValue(new Date(y, m, 1)), to: toDateInputValue(new Date(y, m, 15)) };
  }
  return { from: toDateInputValue(new Date(y, m, 16)), to: toDateInputValue(new Date(y, m + 1, 0)) };
}

type ImportBatch = {
  id: string;
  fileName: string;
  rowCount: number;
  importedCount: number;
  duplicateCount: number;
  importedAt: string;
};

type ImportResult = {
  totalRows: number;
  skippedRows: number;
  newSales: number;
  updatedSales: number;
};

type AdsImportResult = {
  totalRows: number;
  skippedRows: number;
  newRows: number;
  updatedRows: number;
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

  const [adsFile, setAdsFile] = useState<File | null>(null);
  const [adsSubmitting, setAdsSubmitting] = useState(false);
  const [adsResult, setAdsResult] = useState<AdsImportResult | null>(null);
  const [adsError, setAdsError] = useState<string | null>(null);

  const defaultFortnight = currentFortnight();
  const [modalityFrom, setModalityFrom] = useState(defaultFortnight.from);
  const [modalityTo, setModalityTo] = useState(defaultFortnight.to);
  const [modalityFilter, setModalityFilter] = useState("all");
  const [modalityReport, setModalityReport] = useState<ModalityReport | null>(null);
  const [modalityLoading, setModalityLoading] = useState(true);

  useEffect(() => {
    if (!modalityFrom || !modalityTo) return;
    setModalityLoading(true);
    fetch(`/api/sales?from=${modalityFrom}&to=${modalityTo}`)
      .then((r) => r.json())
      .then((body: ModalityReport) => {
        setModalityReport(body);
        setModalityLoading(false);
      });
  }, [modalityFrom, modalityTo]);

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

  async function handleAdsUpload(e: FormEvent) {
    e.preventDefault();
    if (!adsFile) return;
    setAdsSubmitting(true);
    setAdsError(null);
    setAdsResult(null);

    const formData = new FormData();
    formData.append("file", adsFile);

    const res = await fetch("/api/imports/ml-ads", { method: "POST", body: formData });
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
      setAdsError(message);
    } else {
      setAdsResult(body as AdsImportResult);
      setAdsFile(null);
    }
    setAdsSubmitting(false);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-3xl text-foreground">Vendas</h1>
        <p className="text-sm text-muted">
          Importe a planilha de pedidos do Mercado Turbo (Mercado Livre) ou da Shopee pra
          atualizar receita, quantidade e status das vendas — o sistema reconhece o formato
          sozinho. Pedidos já importados (mesmo número) nunca são duplicados — se você reimportar
          uma planilha antiga, os pedidos que já existem são atualizados com os valores dela, não
          duplicados.
        </p>
      </div>

      <form
        onSubmit={handleUpload}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">
            Planilha do Mercado Turbo ou da Shopee (.xlsx)
          </label>
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
          <ul className="flex flex-col gap-1">
            <li>Linhas na planilha: {result.totalRows}</li>
            {result.skippedRows > 0 && (
              <li>Ignoradas por falta de dado essencial (pedido/SKU/data): {result.skippedRows}</li>
            )}
            <li className="text-emerald-400">Vendas novas importadas: {result.newSales}</li>
            <li>Já existentes, atualizadas com os valores desta planilha: {result.updatedSales}</li>
          </ul>
        </div>
      )}

      <div>
        <h2 className="font-serif text-xl text-foreground">Investimento em Ads</h2>
        <p className="text-sm text-muted">
          Importe o relatório "Anúncios patrocinados" do Mercado Livre (com a coluna
          Investimento — não o de "Anúncios vendidos") pra cruzar o gasto de publicidade com
          cada SKU, via código do anúncio.
        </p>
      </div>

      <form
        onSubmit={handleAdsUpload}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">
            Relatório de Anúncios patrocinados do Mercado Livre (.xlsx)
          </label>
          <input
            required
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setAdsFile(e.target.files?.[0] ?? null)}
            className="text-sm text-foreground file:mr-2 file:rounded file:border-0 file:bg-gold file:px-3 file:py-1 file:text-black"
          />
        </div>
        <button
          type="submit"
          disabled={adsSubmitting}
          className="rounded bg-gold px-4 py-1.5 text-sm font-medium text-black transition hover:bg-gold-soft disabled:opacity-50"
        >
          {adsSubmitting ? "Importando..." : "Importar"}
        </button>
      </form>

      {adsError && <p className="text-sm text-red-400">{adsError}</p>}
      {adsResult && (
        <div className="rounded-lg border border-border bg-surface p-4 text-sm">
          <ul className="flex flex-col gap-1">
            <li>Linhas na planilha: {adsResult.totalRows}</li>
            {adsResult.skippedRows > 0 && (
              <li>Ignoradas por falta de dado essencial: {adsResult.skippedRows}</li>
            )}
            <li className="text-emerald-400">Registros novos: {adsResult.newRows}</li>
            <li>Já existentes, atualizados com os valores desta planilha: {adsResult.updatedRows}</li>
          </ul>
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

          <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
            <div>
              <h2 className="font-serif text-lg text-foreground">Conferência por modalidade de envio</h2>
              <p className="text-sm text-muted">
                Filtra as vendas por período exato e por modalidade (Flex, Full, me2, Shopee Xpress...) —
                útil pra bater o número de pedidos Flex do período com a fatura que a transportadora cobra
                à parte (R$12,99/pacote, fora do que o Mercado Turbo já desconta).
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted">De</label>
                <input
                  type="date"
                  value={modalityFrom}
                  onChange={(e) => setModalityFrom(e.target.value)}
                  className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted">Até</label>
                <input
                  type="date"
                  value={modalityTo}
                  onChange={(e) => setModalityTo(e.target.value)}
                  className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted">Modalidade</label>
                <select
                  value={modalityFilter}
                  onChange={(e) => setModalityFilter(e.target.value)}
                  className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
                >
                  <option value="all">Todas</option>
                  {(modalityReport?.byModality ?? []).map((b) => (
                    <option key={b.modality} value={b.modality}>
                      {b.modality}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {modalityLoading || !modalityReport ? (
              <p className="text-sm text-muted">Carregando...</p>
            ) : modalityReport.byModality.length === 0 ? (
              <p className="text-sm text-muted">Nenhuma venda nesse período.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted">
                        <th className="py-1.5 font-medium">Modalidade</th>
                        <th className="py-1.5 font-medium">Pedidos</th>
                        <th className="py-1.5 font-medium">Qtd.</th>
                        <th className="py-1.5 font-medium">Receita bruta</th>
                        <th className="py-1.5 font-medium">Receita líquida</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalityReport.byModality
                        .filter((b) => modalityFilter === "all" || b.modality === modalityFilter)
                        .map((b) => (
                          <tr key={b.modality} className="border-b border-border/50">
                            <td className="py-1.5">{b.modality}</td>
                            <td className="py-1.5">{b.count}</td>
                            <td className="py-1.5">{b.quantity}</td>
                            <td className="py-1.5">{formatBRL(b.grossRevenue)}</td>
                            <td className="py-1.5">{formatBRL(b.netRevenue)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {modalityReport.byModality.some((b) => b.modality === "Flex") && (
                  <div className="flex flex-col gap-1 rounded-lg border border-gold/50 bg-background p-3 text-sm">
                    <span className="font-medium text-foreground">
                      Fatura Flex esperada nesse período: {formatBRL(modalityReport.flexExpectedInvoice)}
                    </span>
                    <span className="text-xs text-muted">
                      {modalityReport.byModality.find((b) => b.modality === "Flex")?.count ?? 0} pedidos Flex
                      × {formatBRL(FLEX_COST_PER_PACKAGE)} — compare com o valor real da fatura da
                      transportadora quando ela chegar (pode haver uma pequena diferença se algum pedido do
                      último dia entrar na próxima quinzena, ou se algum pedido do período foi cancelado
                      depois).
                    </span>
                  </div>
                )}
              </>
            )}
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
                        <td className={`py-1.5 ${Number(s.netRevenue) < 0 ? "text-red-400" : ""}`}>
                          {formatBRL(s.netRevenue)}
                        </td>
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
