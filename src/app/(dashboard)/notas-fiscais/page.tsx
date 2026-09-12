"use client";

import { useEffect, useState, type FormEvent } from "react";
import { formatBRL } from "@/lib/format";
import { HorizontalBarChart } from "@/components/HorizontalBarChart";
import { decodeXml, isZip, readZip } from "@/lib/zipReader";
import { ScanNotePanel } from "@/components/ScanNotePanel";
import { SIMPLES_NACIONAL_CEILING, SIMPLES_NACIONAL_SUBLIMIT } from "@/domain/simplesNacional";

type Group = { key: string; label: string; notes: number; value: number; share: number };

type MonthSummary = {
  month: string;
  saleNotes: number;
  grossSales: number;
  returns: number;
  netSales: number;
  spSales: number;
  spShare: number;
  cancelledNotes: number;
  purchaseNotes: number;
  purchases: number;
  purchaseIcms: number;
  purchaseSimplesCredit: number;
  otherOutflows: number;
};

type Supplier = {
  document: string;
  name: string;
  crt: number | null;
  notes: number;
  value: number;
  icms: number;
  simplesCredit: number;
};

type Report = {
  noteCount: number;
  lastImportedAt: string | null;
  months: MonthSummary[];
  month: string | null;
  detail: {
    month: string;
    byUf: Group[];
    byChannel: Group[];
    byOrigin: Group[];
    byIssuerName: (Group & { icmsCodes: string[] })[];
    byCfopOtherOut: Group[];
    suppliers: Supplier[];
    csosn400: { notes: number; value: number };
  } | null;
  rbt12: { startMonth: string; endMonth: string; value: number; monthsWithData: number } | null;
  codes: Record<CodeKind, CodeBreakdown> | null;
  mlServices: {
    count: number;
    monthTotals: Record<string, number>;
    detail: {
      month: string;
      total: number;
      count: number;
      byCategory: { key: string; label: string; count: number; value: number; share: number }[];
      invoices: {
        providerName: string;
        providerDocument: string;
        providerCity: string;
        amount: number;
        issuedOn: string;
        link: string | null;
        category: string;
      }[];
    } | null;
  };
};

type XmlFile = { name: string; content: string };
type PdfFile = { name: string; base64: string };

type PdfImportResult = {
  files: number;
  newInvoices: number;
  existingInvoices: number;
  ignored: { reason: string; count: number; example: string }[];
};

type ImportResult = {
  files: number;
  newNotes: number;
  updatedNotes: number;
  cancellations: number;
  ignored: { reason: string; count: number; example: string }[];
};

const MONTH_NAMES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function monthLabel(month: string): string {
  const [year, m] = month.split("-");
  return `${MONTH_NAMES[Number(m) - 1]}/${year}`;
}

function pct(fraction: number): string {
  return `${(fraction * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function int(n: number): string {
  return n.toLocaleString("pt-BR");
}

function regimeLabel(crt: number | null): string {
  if (crt === 3) return "Normal";
  if (crt === 1 || crt === 2 || crt === 4) return "Simples";
  return "—";
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

/**
 * Abre .zip (inclusive .zip dentro de .zip), .xml e .pdf soltos, tudo no
 * navegador. XML é nota fiscal; PDF é demonstrativo de nota de serviço do ML.
 */
async function collectFiles(files: File[]): Promise<{ xml: XmlFile[]; pdf: PdfFile[] }> {
  const xml: XmlFile[] = [];
  const pdf: PdfFile[] = [];
  const add = (name: string, data: Uint8Array) => {
    const lower = name.toLowerCase();
    if (lower.endsWith(".xml")) xml.push({ name, content: decodeXml(data) });
    else if (lower.endsWith(".pdf")) pdf.push({ name, base64: toBase64(data) });
  };
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (isZip(bytes)) {
      for (const entry of await readZip(bytes)) add(entry.name, entry.data);
    } else {
      add(file.name, bytes);
    }
  }
  return { xml, pdf };
}

/** Lotes de até ~2 MB de texto: cabe folgado no limite de 4,5 MB por requisição da Vercel. */
function toBatches<T>(files: T[], sizeOf: (f: T) => number, maxChars = 2_000_000): T[][] {
  const batches: T[][] = [];
  let current: T[] = [];
  let size = 0;
  for (const f of files) {
    if (current.length > 0 && size + sizeOf(f) > maxChars) {
      batches.push(current);
      current = [];
      size = 0;
    }
    current.push(f);
    size += sizeOf(f);
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

function mergeResults(a: ImportResult, b: ImportResult): ImportResult {
  const ignored = new Map(a.ignored.map((i) => [i.reason, { ...i }]));
  for (const i of b.ignored) {
    const e = ignored.get(i.reason);
    if (e) e.count += i.count;
    else ignored.set(i.reason, { ...i });
  }
  return {
    files: a.files + b.files,
    newNotes: a.newNotes + b.newNotes,
    updatedNotes: a.updatedNotes + b.updatedNotes,
    cancellations: a.cancellations + b.cancellations,
    ignored: [...ignored.values()],
  };
}

const EMPTY_RESULT: ImportResult = { files: 0, newNotes: 0, updatedNotes: 0, cancellations: 0, ignored: [] };

function mergePdfResults(a: PdfImportResult | null, b: PdfImportResult): PdfImportResult {
  if (!a) return b;
  const ignored = new Map(a.ignored.map((i) => [i.reason, { ...i }]));
  for (const i of b.ignored) {
    const e = ignored.get(i.reason);
    if (e) e.count += i.count;
    else ignored.set(i.reason, { ...i });
  }
  return {
    files: a.files + b.files,
    newInvoices: a.newInvoices + b.newInvoices,
    existingInvoices: a.existingInvoices + b.existingInvoices,
    ignored: [...ignored.values()],
  };
}

function StatCard({
  label,
  value,
  note,
  tone = "gold",
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "gold" | "pending" | "negative";
}) {
  const valueColor = tone === "pending" ? "text-amber-300" : tone === "negative" ? "text-red-400" : "text-gold";
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
      <span className="text-xs font-medium tracking-wide text-muted uppercase">{label}</span>
      <span className={`font-serif text-2xl ${valueColor}`}>{value}</span>
      {note && <span className="text-xs text-muted">{note}</span>}
    </div>
  );
}

function ImportPanel({ onImported, compact }: { onImported: () => void; compact: boolean }) {
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pdfResult, setPdfResult] = useState<PdfImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (files.length === 0) return;
    setError(null);
    setResult(null);
    setPdfResult(null);
    setProgress({ done: 0, total: 0 });

    let collected: { xml: XmlFile[]; pdf: PdfFile[] };
    try {
      collected = await collectFiles(files);
    } catch (err) {
      setProgress(null);
      setError(err instanceof Error ? err.message : "Não foi possível abrir o arquivo.");
      return;
    }
    const grandTotal = collected.xml.length + collected.pdf.length;
    if (grandTotal === 0) {
      setProgress(null);
      setError("Nenhum XML de nota nem PDF de demonstrativo do Mercado Livre nos arquivos escolhidos.");
      return;
    }

    let total = EMPTY_RESULT;
    let pdfTotal: PdfImportResult | null = null;
    let done = 0;
    setProgress({ done, total: grandTotal });

    const fail = (message: string) => {
      setProgress(null);
      setError(
        `${message}${
          done > 0
            ? ` ${int(done)} de ${int(grandTotal)} arquivos já tinham sido importados; importe de novo para completar (o que já entrou não duplica).`
            : ""
        }`,
      );
      if (done > 0) {
        setResult(collected.xml.length > 0 ? total : null);
        setPdfResult(pdfTotal);
        onImported();
      }
    };

    for (const batch of toBatches(collected.xml, (f) => f.content.length)) {
      const res = await fetch("/api/imports/nfe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: batch }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return fail(body.error ?? "A importação parou no meio.");
      total = mergeResults(total, body as ImportResult);
      done += batch.length;
      setProgress({ done, total: grandTotal });
    }

    for (const batch of toBatches(collected.pdf, (f) => f.base64.length)) {
      const res = await fetch("/api/imports/ml-services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: batch }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return fail(body.error ?? "A importação dos PDFs parou no meio.");
      pdfTotal = mergePdfResults(pdfTotal, body as PdfImportResult);
      done += batch.length;
      setProgress({ done, total: grandTotal });
    }

    setProgress(null);
    setResult(collected.xml.length > 0 ? total : null);
    setPdfResult(pdfTotal);
    onImported();
  }

  const busy = progress !== null;

  return (
    <form onSubmit={handleSubmit} className="no-print flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div>
        <h2 className={compact ? "text-xs font-medium tracking-wide text-muted uppercase" : "font-serif text-xl text-gold"}>
          Importar notas
        </h2>
        <p className="max-w-prose text-sm text-muted">
          Pode ser o .zip que o Tiny exporta, XMLs soltos ou os dois — notas de venda, de devolução do
          Mercado Livre e de compra de fornecedores. Arquivos de cancelamento também são lidos. Os PDFs
          &quot;Demonstrativo de Nota Fiscal&quot; que o Mercado Livre manda (tarifas, envios, Mercado Pago)
          entram pelo mesmo botão. Importar a mesma nota de novo não duplica.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept=".zip,.xml,.pdf"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="text-sm text-muted file:mr-3 file:rounded file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm file:text-foreground"
        />
        <button
          type="submit"
          disabled={files.length === 0 || busy}
          className="rounded-md border border-gold px-4 py-2 text-sm text-gold transition hover:bg-gold hover:text-background disabled:cursor-not-allowed disabled:border-border disabled:text-muted disabled:hover:bg-transparent disabled:hover:text-muted"
        >
          {busy ? "Importando..." : "Importar"}
        </button>
      </div>

      {progress && (
        <div className="flex flex-col gap-1">
          <div className="h-2 w-full max-w-md rounded-full bg-background">
            <div
              className="h-2 rounded-full bg-gold transition-all"
              style={{ width: progress.total > 0 ? `${(progress.done / progress.total) * 100}%` : "4%" }}
            />
          </div>
          <span className="text-xs text-muted">
            {progress.total === 0
              ? "Abrindo o arquivo..."
              : `${int(progress.done)} de ${int(progress.total)} arquivos enviados`}
          </span>
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
      {result && (
        <div className="flex flex-col gap-1 text-sm">
          <p className="text-emerald-400">
            {int(result.files)} arquivos lidos — {int(result.newNotes)} notas novas
            {result.updatedNotes > 0 && `, ${int(result.updatedNotes)} que já estavam no sistema`}
            {result.cancellations > 0 && `, ${int(result.cancellations)} cancelamentos`}.
          </p>
          {result.ignored.map((i) => (
            <p key={i.reason} className="text-amber-300">
              {int(i.count)} {i.count === 1 ? "arquivo ignorado" : "arquivos ignorados"}: {i.reason}{" "}
              <span className="text-xs text-muted">(ex.: {i.example})</span>
            </p>
          ))}
        </div>
      )}
      {pdfResult && (
        <div className="flex flex-col gap-1 text-sm">
          <p className="text-emerald-400">
            {int(pdfResult.files)} PDFs do Mercado Livre lidos — {int(pdfResult.newInvoices)} notas de serviço novas
            {pdfResult.existingInvoices > 0 && `, ${int(pdfResult.existingInvoices)} que já estavam no sistema`}.
          </p>
          {pdfResult.ignored.map((i) => (
            <p key={i.reason} className="text-amber-300">
              {int(i.count)} {i.count === 1 ? "PDF ignorado" : "PDFs ignorados"}: {i.reason}{" "}
              <span className="text-xs text-muted">(ex.: {i.example})</span>
            </p>
          ))}
        </div>
      )}
    </form>
  );
}

type CodeGroup = { code: string; label: string; notes: number; value: number; share: number };
type CodeBreakdown = { byNcm: CodeGroup[]; byCfop: CodeGroup[]; byIcmsCode: CodeGroup[] };
type CodeKind = "sale" | "return" | "purchase";

const CODE_KINDS: { key: CodeKind; label: string }[] = [
  { key: "sale", label: "Vendas" },
  { key: "return", label: "Devoluções" },
  { key: "purchase", label: "Compras" },
];

function CodeTable({
  title,
  codeHeader,
  labelHeader,
  rows,
  highlight,
}: {
  title: string;
  codeHeader: string;
  labelHeader: string;
  rows: CodeGroup[];
  highlight?: (code: string) => boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-medium tracking-wide text-muted uppercase">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">Nenhum item neste mês.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-2xl text-sm">
            <thead className="bg-surface">
              <tr className="text-xs tracking-wide text-muted uppercase">
                <th className="px-4 py-3 text-left font-medium">{codeHeader}</th>
                <th className="px-4 py-3 text-left font-medium">{labelHeader}</th>
                <th className="px-4 py-3 text-right font-medium">Notas</th>
                <th className="px-4 py-3 text-right font-medium">Valor</th>
                <th className="px-4 py-3 text-right font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.code} className="border-t border-border">
                  <td
                    className={`px-4 py-2 whitespace-nowrap tabular-nums ${
                      highlight?.(r.code) ? "text-amber-300" : "text-foreground"
                    }`}
                  >
                    {r.code}
                  </td>
                  <td className="px-4 py-2 text-muted">{r.label}</td>
                  <td className="px-4 py-2 text-right text-muted tabular-nums">{int(r.notes)}</td>
                  <td className="px-4 py-2 text-right text-foreground tabular-nums">{formatBRL(r.value)}</td>
                  <td className="px-4 py-2 text-right text-muted tabular-nums">{pct(r.share)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FiscalCodesSection({ month, codes }: { month: string; codes: Record<CodeKind, CodeBreakdown> }) {
  const [kind, setKind] = useState<CodeKind>("sale");
  const current = codes[kind];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-xl text-foreground">NCM, CFOP e CST/CSOSN de {monthLabel(month)}</h2>
        <div className="flex rounded-md border border-border p-0.5 text-sm" role="tablist" aria-label="Tipo de nota">
          {CODE_KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              role="tab"
              aria-selected={kind === k.key}
              onClick={() => setKind(k.key)}
              className={
                kind === k.key
                  ? "rounded bg-gold/15 px-3 py-1 font-medium text-gold"
                  : "rounded px-3 py-1 text-muted transition hover:text-gold-soft"
              }
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>
      <CodeTable title="NCM (classificação do produto)" codeHeader="NCM" labelHeader="Exemplo de produto" rows={current.byNcm} />
      <CodeTable title="CFOP (tipo de operação)" codeHeader="CFOP" labelHeader="O que significa" rows={current.byCfop} />
      <CodeTable
        title="CST / CSOSN do ICMS"
        codeHeader="Código"
        labelHeader="O que significa"
        rows={current.byIcmsCode}
        highlight={(code) => code === "CSOSN 400"}
      />
      <p className="max-w-prose text-xs text-muted">
        CFOP e CST/CSOSN são sempre os de quem emitiu a nota: nas compras, aparecem os códigos do fornecedor.
        CSOSN é o código de quem está no Simples; CST, de quem está no regime normal. O valor soma os itens
        (produto − desconto + frete e outras despesas do item) e deixa as notas canceladas de fora.
      </p>
    </section>
  );
}

export default function NotasFiscaisPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [month, setMonth] = useState<string | null>(null);

  // O efeito só dispara o fetch; o estado muda na resposta.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/fiscal-notes${month ? `?month=${month}` : ""}`)
      .then((res) => res.json())
      .then((data: Report) => {
        if (!cancelled) setReport(data);
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  async function reload() {
    const res = await fetch(`/api/fiscal-notes${month ? `?month=${month}` : ""}`);
    setReport(await res.json());
  }

  if (!report) return <p className="text-sm text-muted">Carregando...</p>;

  const selected = report.months.find((m) => m.month === report.month) ?? null;
  const detail = report.detail;
  const rbt12 = report.rbt12;
  const mlDetail = report.mlServices.detail;
  const mlLabels = new Map((mlDetail?.byCategory ?? []).map((g) => [g.key, g.label]));
  const monthsDesc = [...report.months].reverse();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-3xl text-foreground">Notas Fiscais</h1>
        <p className="text-sm text-muted">
          O faturamento de verdade, lido dos XMLs das notas: vendas, devoluções, estados, canais e compras.
        </p>
        {report.noteCount > 0 && (
          <p className="mt-1 text-xs text-muted">
            {int(report.noteCount)} notas no sistema
            {report.lastImportedAt &&
              ` · última importação em ${new Date(report.lastImportedAt).toLocaleString("pt-BR")}`}
          </p>
        )}
      </div>

      <ScanNotePanel onChanged={reload} />

      {report.noteCount === 0 || !selected || !detail ? (
        <ImportPanel onImported={reload} compact={false} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="month" className="text-sm text-muted">
              Mês
            </label>
            <select
              id="month"
              value={report.month ?? ""}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
            >
              {monthsDesc.map((m) => (
                <option key={m.month} value={m.month}>
                  {monthLabel(m.month)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Faturamento"
              value={formatBRL(selected.netSales)}
              note={
                selected.returns > 0
                  ? `vendas ${formatBRL(selected.grossSales)} − devoluções ${formatBRL(selected.returns)}`
                  : "vendas do mês, sem devoluções importadas"
              }
            />
            <StatCard
              label="Notas de venda"
              value={int(selected.saleNotes)}
              note={`ticket médio ${formatBRL(selected.saleNotes > 0 ? selected.grossSales / selected.saleNotes : 0)}${
                selected.cancelledNotes > 0 ? ` · ${int(selected.cancelledNotes)} canceladas, fora da conta` : ""
              }`}
            />
            <StatCard
              label="Vendas para SP"
              value={pct(selected.spShare)}
              note={`${formatBRL(selected.spSales)} ficam no estado; o resto é venda interestadual`}
            />
            <StatCard
              label="Compras"
              value={formatBRL(selected.purchases)}
              note={
                selected.purchaseNotes > 0
                  ? `${int(selected.purchaseNotes)} notas · ICMS destacado ${formatBRL(selected.purchaseIcms + selected.purchaseSimplesCredit)}`
                  : "nenhuma nota de compra importada neste mês"
              }
              tone={selected.purchaseNotes > 0 ? "gold" : "pending"}
            />
          </div>

          {rbt12 && (
            <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xs font-medium tracking-wide text-muted uppercase">
                  Receita dos últimos 12 meses pelas notas (RBT12)
                </h2>
                <span className="text-xs text-muted">
                  {monthLabel(rbt12.startMonth)} a {monthLabel(rbt12.endMonth)}
                </span>
              </div>
              <span className="font-serif text-2xl text-gold">{formatBRL(rbt12.value)}</span>
              {rbt12.monthsWithData < 12 ? (
                <p className="max-w-prose text-sm text-amber-300">
                  Só {rbt12.monthsWithData} dos 12 meses {rbt12.monthsWithData === 1 ? "tem" : "têm"} notas importadas, então este valor está
                  incompleto. Importe os XMLs dos meses que faltam para comparar com o sublimite de{" "}
                  {formatBRL(SIMPLES_NACIONAL_SUBLIMIT)} e o teto de {formatBRL(SIMPLES_NACIONAL_CEILING)} do
                  Simples.
                </p>
              ) : (
                <p className="max-w-prose text-sm text-muted">
                  {pct(rbt12.value / SIMPLES_NACIONAL_CEILING)} do teto do Simples (
                  {formatBRL(SIMPLES_NACIONAL_CEILING)}).{" "}
                  {rbt12.value > SIMPLES_NACIONAL_SUBLIMIT
                    ? `Acima do sublimite de ${formatBRL(SIMPLES_NACIONAL_SUBLIMIT)}: o ICMS sai do DAS.`
                    : `Faltam ${formatBRL(SIMPLES_NACIONAL_SUBLIMIT - rbt12.value)} para o sublimite de ${formatBRL(SIMPLES_NACIONAL_SUBLIMIT)}.`}
                </p>
              )}
            </section>
          )}

          {(detail.csosn400.notes > 0 || detail.byIssuerName.length > 1) && (
            <section className="flex flex-col gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-100">
              <h2 className="font-medium text-amber-300">Para conferir com o contador</h2>
              {detail.byIssuerName.length > 1 && (
                <p>
                  As notas de venda saem com {detail.byIssuerName.length} nomes de emitente diferentes para o
                  mesmo CNPJ ({detail.byIssuerName.map((g) => `"${g.label}"`).join(", ")}) — sinal de dois
                  cadastros ou duas contas emitindo, possivelmente com configurações diferentes.
                </p>
              )}
              {detail.csosn400.notes > 0 && (
                <p>
                  {int(detail.csosn400.notes)} notas de venda ({formatBRL(detail.csosn400.value)}) saíram com
                  CSOSN 400, &quot;não tributada pelo Simples Nacional&quot;. Em venda comum de empresa do
                  Simples o código costuma ser o 102. O DAS é calculado sobre o faturamento declarado, então
                  isso não muda o imposto sozinho, mas vale revisar a configuração fiscal no Tiny.
                </p>
              )}
            </section>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <HorizontalBarChart
              title="Vendas por estado do comprador"
              data={detail.byUf.slice(0, 12).map((g) => ({ name: `${g.label} · ${pct(g.share)}`, total: g.value }))}
            />
            <div className="flex flex-col gap-4">
              <HorizontalBarChart
                title="Vendas por canal"
                data={detail.byChannel.map((g) => ({ name: `${g.label} · ${pct(g.share)}`, total: g.value }))}
              />
              <HorizontalBarChart
                title="Produção própria × revenda (pelo CFOP)"
                data={detail.byOrigin.map((g) => ({ name: `${g.label} · ${pct(g.share)}`, total: g.value }))}
              />
            </div>
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="font-serif text-xl text-foreground">Mês a mês</h2>
            <p className="max-w-prose text-sm text-muted">
              Clique num mês para ver o detalhe. Faturamento é venda menos devolução, pela data de emissão
              das notas; notas canceladas ficam de fora.
            </p>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-3xl text-sm">
                <thead className="bg-surface">
                  <tr className="text-xs tracking-wide text-muted uppercase">
                    <th className="px-4 py-3 text-left font-medium">Mês</th>
                    <th className="px-4 py-3 text-right font-medium">Notas</th>
                    <th className="px-4 py-3 text-right font-medium">Vendas</th>
                    <th className="px-4 py-3 text-right font-medium">Devoluções</th>
                    <th className="px-4 py-3 text-right font-medium">Faturamento</th>
                    <th className="px-4 py-3 text-right font-medium">SP</th>
                    <th className="px-4 py-3 text-right font-medium">Compras</th>
                    <th className="px-4 py-3 text-right font-medium">Serviços ML</th>
                    <th
                      className="px-4 py-3 text-right font-medium"
                      title="Serviços ML (frete + Ebazar + Mercado Pago) dividido pelo faturamento do mês."
                    >
                      % Faturamento
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {monthsDesc.map((m) => {
                    const mlTotal = report.mlServices.monthTotals[m.month];
                    return (
                      <tr
                        key={m.month}
                        onClick={() => setMonth(m.month)}
                        className={`cursor-pointer border-t border-border transition hover:bg-surface-hover ${
                          m.month === report.month ? "bg-gold/10" : ""
                        }`}
                      >
                        <td className="px-4 py-2 text-foreground">{monthLabel(m.month)}</td>
                        <td className="px-4 py-2 text-right text-muted tabular-nums">{int(m.saleNotes)}</td>
                        <td className="px-4 py-2 text-right text-foreground tabular-nums">{formatBRL(m.grossSales)}</td>
                        <td className="px-4 py-2 text-right text-muted tabular-nums">{formatBRL(m.returns)}</td>
                        <td className="px-4 py-2 text-right font-medium text-gold tabular-nums">
                          {formatBRL(m.netSales)}
                          {m.saleNotes === 0 && m.returns > 0 && (
                            <span className="block text-xs font-normal text-amber-300">
                              só devoluções — vendas do mês não importadas
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right text-muted tabular-nums">{pct(m.spShare)}</td>
                        <td className="px-4 py-2 text-right text-muted tabular-nums">{formatBRL(m.purchases)}</td>
                        <td className="px-4 py-2 text-right text-muted tabular-nums">
                          {mlTotal ? formatBRL(mlTotal) : "—"}
                        </td>
                        <td className="px-4 py-2 text-right text-muted tabular-nums">
                          {mlTotal && m.netSales > 0 ? pct(mlTotal / m.netSales) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {report.codes && <FiscalCodesSection key={detail.month} month={detail.month} codes={report.codes} />}

          <section className="flex flex-col gap-3">
            <h2 className="font-serif text-xl text-foreground">Quem emitiu as vendas de {monthLabel(detail.month)}</h2>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-xl text-sm">
                <thead className="bg-surface">
                  <tr className="text-xs tracking-wide text-muted uppercase">
                    <th className="px-4 py-3 text-left font-medium">Nome na nota</th>
                    <th className="px-4 py-3 text-right font-medium">Notas</th>
                    <th className="px-4 py-3 text-right font-medium">Valor</th>
                    <th className="px-4 py-3 text-left font-medium">ICMS (CSOSN)</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.byIssuerName.map((g) => (
                    <tr key={g.key} className="border-t border-border">
                      <td className="px-4 py-2 text-foreground">{g.label}</td>
                      <td className="px-4 py-2 text-right text-muted tabular-nums">{int(g.notes)}</td>
                      <td className="px-4 py-2 text-right text-foreground tabular-nums">{formatBRL(g.value)}</td>
                      <td className="px-4 py-2">
                        {g.icmsCodes.map((code) => (
                          <span
                            key={code}
                            className={`mr-1 rounded-full px-2 py-0.5 text-xs ${
                              code === "400" ? "bg-amber-400/15 text-amber-300" : "bg-emerald-500/15 text-emerald-400"
                            }`}
                          >
                            {code}
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-serif text-xl text-foreground">Compras de {monthLabel(detail.month)}</h2>
            {detail.suppliers.length === 0 ? (
              <p className="max-w-prose text-sm text-muted">
                Nenhuma nota de compra importada neste mês. Importe os XMLs que os fornecedores mandam para ver
                o total comprado e o ICMS destacado em cada nota.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-2xl text-sm">
                  <thead className="bg-surface">
                    <tr className="text-xs tracking-wide text-muted uppercase">
                      <th className="px-4 py-3 text-left font-medium">Fornecedor</th>
                      <th className="px-4 py-3 text-left font-medium">Regime</th>
                      <th className="px-4 py-3 text-right font-medium">Notas</th>
                      <th className="px-4 py-3 text-right font-medium">Valor</th>
                      <th className="px-4 py-3 text-right font-medium">ICMS destacado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.suppliers.map((s) => (
                      <tr key={s.document} className="border-t border-border">
                        <td className="px-4 py-2 text-foreground">{s.name}</td>
                        <td className="px-4 py-2 text-muted">{regimeLabel(s.crt)}</td>
                        <td className="px-4 py-2 text-right text-muted tabular-nums">{int(s.notes)}</td>
                        <td className="px-4 py-2 text-right text-foreground tabular-nums">{formatBRL(s.value)}</td>
                        <td className="px-4 py-2 text-right text-muted tabular-nums">
                          {formatBRL(s.icms + s.simplesCredit)}
                          {s.value > 0 && ` · ${pct((s.icms + s.simplesCredit) / s.value)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="max-w-prose text-xs text-muted">
              O ICMS destacado é o crédito que a compra geraria fora do Simples. Fornecedor do regime normal
              destaca a alíquota cheia; fornecedor do Simples só informa o crédito permitido (em geral bem menor).
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-serif text-xl text-foreground">
              Serviços do Mercado Livre de {monthLabel(detail.month)}
            </h2>
            {!mlDetail || mlDetail.count === 0 ? (
              <p className="max-w-prose text-sm text-muted">
                Nenhuma nota de serviço do Mercado Livre importada para este mês. Importe o .zip com os PDFs
                &quot;Demonstrativo de Nota Fiscal&quot; que o ML manda, pelo mesmo botão de importar.
              </p>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <StatCard
                    label="Cobrado pelo grupo Mercado Livre"
                    value={formatBRL(mlDetail.total)}
                    note={`${int(mlDetail.count)} notas de serviço`}
                  />
                  <StatCard
                    label="Sobre o faturamento do mês"
                    value={selected.netSales > 0 ? pct(mlDetail.total / selected.netSales) : "—"}
                    note={
                      selected.netSales > 0
                        ? "notas de serviço do ML ÷ faturamento pelas notas de venda"
                        : "as vendas deste mês ainda não foram importadas"
                    }
                    tone={selected.netSales > 0 ? "gold" : "pending"}
                  />
                </div>
                <HorizontalBarChart
                  title="Por tipo (pelo prestador)"
                  data={mlDetail.byCategory.map((g) => ({ name: `${g.label} · ${pct(g.share)}`, total: g.value }))}
                />
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-2xl text-sm">
                    <thead className="bg-surface">
                      <tr className="text-xs tracking-wide text-muted uppercase">
                        <th className="px-4 py-3 text-left font-medium">Prestador</th>
                        <th className="px-4 py-3 text-left font-medium">Cidade</th>
                        <th className="px-4 py-3 text-left font-medium">Tipo</th>
                        <th className="px-4 py-3 text-right font-medium">Valor</th>
                        <th className="px-4 py-3 text-left font-medium">Nota</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mlDetail.invoices.map((inv, i) => (
                        <tr key={`${inv.providerDocument}-${inv.amount}-${i}`} className="border-t border-border">
                          <td className="px-4 py-2 text-foreground">{inv.providerName}</td>
                          <td className="px-4 py-2 text-muted">{inv.providerCity}</td>
                          <td className="px-4 py-2 text-muted">{mlLabels.get(inv.category) ?? inv.category}</td>
                          <td className="px-4 py-2 text-right text-foreground tabular-nums">{formatBRL(inv.amount)}</td>
                          <td className="px-4 py-2">
                            {inv.link && !/rps\.aspx$/i.test(inv.link) ? (
                              <a
                                href={inv.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gold-soft underline underline-offset-2 hover:text-gold"
                              >
                                abrir
                              </a>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <p className="max-w-prose text-xs text-muted">
              Quase tudo isso o Mercado Livre já desconta de cada repasse: é custo do mês, não conta a pagar
              (lançar como conta contaria o custo duas vezes). O ciclo do ML fecha por volta do dia 19, então a
              nota de um mês cobre mais ou menos do dia 20 do mês anterior ao dia 19. O demonstrativo não diz
              qual é o serviço, então o tipo sai do prestador: filiais &quot;ENVIOS&quot; são frete.
            </p>
          </section>

          {detail.byCfopOtherOut.length > 0 && (
            <p className="max-w-prose text-xs text-muted">
              Outras saídas que não são venda e não entram no faturamento:{" "}
              {detail.byCfopOtherOut.map((g) => `CFOP ${g.label} (${formatBRL(g.value)})`).join(", ")}.
            </p>
          )}

          <ImportPanel onImported={reload} compact />
        </>
      )}
    </div>
  );
}
