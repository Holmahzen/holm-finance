"use client";

import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { formatBRL } from "@/lib/format";
import { billingGroup, billingTotals, summarizeMlBillingRows, type BillingLine, type BillingSummary } from "@/domain/mlBilling";

type Saved = BillingSummary & { importedAt: string };

const GROUP_LABEL: Record<ReturnType<typeof billingGroup>, string> = {
  ads: "Ads (Product Ads)",
  full: "Full (armazenamento, coleta...)",
  frete: "Frete e devoluções",
  venda: "Tarifa de venda",
  pagamento: "Mercado Pago (cobrança e parcelamento)",
  outros: "Outras",
};

const day = (iso: string) => iso.split("-").reverse().join("/");

function groupTotals(lines: BillingLine[]) {
  const map = new Map<ReturnType<typeof billingGroup>, number>();
  for (const l of lines) {
    const g = billingGroup(l.detail);
    map.set(g, (map.get(g) ?? 0) + l.amount);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function LinesTable({ title, hint, lines }: { title: string; hint: string; lines: BillingLine[] }) {
  const total = lines.reduce((s, l) => s + l.amount, 0);
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="font-serif text-lg text-foreground">{title}</h3>
          <p className="text-xs text-muted">{hint}</p>
        </div>
        <span className="font-serif text-2xl text-gold">{formatBRL(total)}</span>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {groupTotals(lines).map(([g, v]) => (
          <span key={g} className="text-muted">
            {GROUP_LABEL[g]}: <strong className="text-foreground">{formatBRL(v)}</strong> ({total > 0 ? ((v / total) * 100).toFixed(0) : 0}%)
          </span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-xl text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="py-2 font-medium">Tarifa</th>
              <th className="py-2 text-right font-medium">Cobranças</th>
              <th className="py-2 text-right font-medium">Valor</th>
            </tr>
          </thead>
          <tbody>
            {[...lines]
              .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
              .map((l) => (
                <tr key={l.detail} className="border-b border-border/50">
                  <td className="py-1.5 text-foreground">{l.detail}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted">{l.count.toLocaleString("pt-BR")}</td>
                  <td className="py-1.5 text-right tabular-nums text-foreground">{formatBRL(l.amount)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function TarifasMlPage() {
  const [saved, setSaved] = useState<Saved[]>([]);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function reload() {
    fetch("/api/imports/ml-billing")
      .then((r) => r.json())
      .then((list: Saved[]) => {
        setSaved(list);
        setSelected(0);
      });
  }

  useEffect(() => {
    fetch("/api/imports/ml-billing")
      .then((r) => r.json())
      .then((list: Saved[]) => setSaved(list));
  }, []);

  async function handleFile(file: File) {
    setBusy(true);
    setMessage(null);
    try {
      // O arquivo passa de 4,5 MB (limite do servidor): lê aqui e envia só o resumo.
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
      const summary = summarizeMlBillingRows(rows);
      const res = await fetch("/api/imports/ml-billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(summary),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : "Não foi possível salvar o resumo.");
      const t = billingTotals(summary.lines);
      setMessage({
        ok: true,
        text: `Relatório lido: ${day(summary.periodStart)} a ${day(summary.periodEnd)} — ${formatBRL(t.billed)} na fatura a pagar e ${formatBRL(t.deducted)} já descontados do repasse.`,
      });
      reload();
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Erro ao ler o relatório." });
    } finally {
      setBusy(false);
    }
  }

  const current = saved[selected];
  const totals = current ? billingTotals(current.lines) : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl text-foreground">Tarifas do Mercado Livre</h1>
        <p className="text-sm text-muted">
          Resumo do <strong className="text-foreground">Relatório de Faturamento</strong> do Mercado Livre: o que já saiu do
          repasse e o que vai na fatura a pagar, por tipo de tarifa (Ads, Full, frete, tarifa de venda).
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <label className="text-xs font-medium text-muted" htmlFor="ml-billing-file">
          Relatório de Faturamento do Mercado Livre (.xlsx)
        </label>
        <input
          id="ml-billing-file"
          type="file"
          accept=".xlsx"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
          className="text-sm text-foreground"
        />
        {busy && <p className="text-sm text-muted">Lendo o arquivo (pode levar alguns segundos)...</p>}
        {message && <p className={`text-sm ${message.ok ? "text-emerald-400" : "text-red-400"}`}>{message.text}</p>}
        <p className="text-xs text-muted">
          O arquivo é lido no seu navegador e só o resumo é enviado. Importar o mesmo período de novo substitui o resumo, sem
          duplicar.
        </p>
      </div>

      {saved.length === 0 ? (
        <p className="text-sm text-muted">Nenhum relatório importado ainda.</p>
      ) : (
        current &&
        totals && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">Ciclo:</span>
              {saved.map((s, i) => (
                <button
                  key={`${s.periodStart}|${s.periodEnd}`}
                  onClick={() => setSelected(i)}
                  className={`rounded border px-3 py-1 ${i === selected ? "border-gold text-gold" : "border-border text-muted hover:text-foreground"}`}
                >
                  {day(s.periodStart)} a {day(s.periodEnd)}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-gold/40 bg-surface p-4">
                <span className="text-xs font-medium tracking-wide text-gold uppercase">Fatura a pagar</span>
                <p className="font-serif text-3xl text-gold">{formatBRL(totals.billed)}</p>
                <p className="text-xs text-muted">tarifas que não saíram do repasse</p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-4">
                <span className="text-xs font-medium tracking-wide text-muted uppercase">Já descontado do repasse</span>
                <p className="font-serif text-3xl text-foreground">{formatBRL(totals.deducted)}</p>
                <p className="text-xs text-muted">não sai da conta de novo</p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-4">
                <span className="text-xs font-medium tracking-wide text-muted uppercase">Tarifas do ciclo</span>
                <p className="font-serif text-3xl text-foreground">{formatBRL(totals.total)}</p>
                <p className="text-xs text-muted">inclui {formatBRL(totals.notApplicable)} de canceladas/estornadas</p>
              </div>
            </div>
            <p className="text-xs text-muted">
              O valor cobrado pelo ML pode ser menor que a &quot;fatura a pagar&quot; do relatório: tarifas de devolução já
              compensadas por estorno não entram na cobrança. Confira com a tela &quot;Total da dívida&quot; do Mercado Livre.
            </p>
            <LinesTable title="Fatura a pagar" hint="Não descontadas da operação" lines={current.lines.filter((l) => l.deducted === "NAO")} />
            <LinesTable title="Já descontado do repasse" hint="Descontadas da operação" lines={current.lines.filter((l) => l.deducted === "SIM")} />
          </>
        )
      )}
    </div>
  );
}
