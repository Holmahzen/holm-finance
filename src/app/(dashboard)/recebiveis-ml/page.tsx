"use client";

import { useEffect, useState, type FormEvent } from "react";
import { formatBRL } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";

type ReleaseDay = {
  date: string;
  count: number;
  amount: number;
  cumulative: number;
  released: boolean;
};

type Buckets = { today: number; tomorrow: number; within7d: number; after7d: number };

type ReleaseReport = {
  fonte: "mercado-pago" | "planilha";
  motivoFallback: string | null;
  releaseDelayDays: number | null;
  ultimaSincronizacao: string | null;
  salesCount: number;
  withDeliveryDate: number;
  lastImportedAt: string | null;
  firstSaleDate: string | null;
  lastSaleDate: string | null;
  daysSinceLastSale: number | null;
  janelaInicio: string;
  diasDeHistorico: number;
  days: ReleaseDay[];
  releasedTotal: number;
  scheduledTotal: number;
  awaitingDelivery: { count: number; amount: number };
  atRisk: { count: number; amount: number };
  noCashCount: number;
  total: number;
  buckets: Buckets;
  saved: Buckets;
};

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** As datas vêm como "YYYY-MM-DD" e representam dias em UTC — montar com
 * `new Date(texto)` local deslocaria o dia inteiro no fuso do Brasil. */
function parseDay(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Com o dado real do Mercado Pago o calendário atravessa anos — um repasse
 * antigo reaberto por estorno volta a aparecer. Sem o ano, "2 nov" no meio de
 * datas de maio parece lista fora de ordem. */
function formatDay(iso: string, comAno = false): string {
  const d = parseDay(iso);
  const base = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  return comAno ? `${base} ${String(d.getUTCFullYear()).slice(2)}` : base;
}

function formatWeekday(iso: string): string {
  return WEEKDAYS[parseDay(iso).getUTCDay()];
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
  tone?: "gold" | "positive" | "pending" | "negative";
}) {
  const valueColor =
    tone === "positive"
      ? "text-emerald-400"
      : tone === "pending"
        ? "text-amber-300"
        : tone === "negative"
          ? "text-red-400"
          : "text-gold";

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
      <span className="text-xs font-medium tracking-wide text-muted uppercase">{label}</span>
      <span className={`font-serif text-2xl ${valueColor}`}>{value}</span>
      {note && <span className="text-xs text-muted">{note}</span>}
    </div>
  );
}

function ReleaseChart({ days, comAno }: { days: ReleaseDay[]; comAno: boolean }) {
  const max = Math.max(1, ...days.map((d) => d.amount));

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xs font-medium tracking-wide text-muted uppercase">
          Repasse por dia
        </h2>
        <div className="flex gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-xs bg-emerald-500" />
            liberado
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-xs bg-amber-400" />a liberar
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex min-w-max items-end gap-1" style={{ height: 180 }}>
          {days.map((d) => (
            <div
              key={d.date}
              className="flex h-full w-6 flex-col justify-end"
              title={`${formatDay(d.date, true)} (${formatWeekday(d.date)}) — ${formatBRL(d.amount)} · ${d.count} pagamentos`}
            >
              <div
                className={`w-full rounded-t-xs ${d.released ? "bg-emerald-500" : "bg-amber-400"}`}
                style={{ height: `${Math.max(2, (d.amount / max) * 100)}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex min-w-max gap-1">
          {days.map((d, i) => (
            <span key={d.date} className="w-6 text-center text-[10px] text-muted">
              {i % 3 === 0 || i === days.length - 1 ? formatDay(d.date, comAno) : ""}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

type ImportResult = {
  totalRows: number;
  skippedRows: number;
  newSales: number;
  updatedSales: number;
  withDeliveryDate: number;
};

function ImportPanel({
  onImported,
  compact,
}: {
  onImported: () => void;
  compact: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;

    setError(null);
    setResult(null);
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/imports/mercadolivre", { method: "POST", body: formData });
    const body = await res.json();
    setUploading(false);

    if (!res.ok) {
      setError(body.error ?? "Não foi possível importar a planilha.");
      return;
    }
    setResult(body);
    onImported();
  }

  return (
    <form
      onSubmit={handleUpload}
      className="no-print flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
    >
      <div>
        <h2 className={compact ? "text-xs font-medium tracking-wide text-muted uppercase" : "font-serif text-xl text-gold"}>
          Importar relatório de vendas
        </h2>
        <p className="max-w-prose text-sm text-muted">
          O arquivo é o que o Mercado Livre exporta em Vendas &gt; Baixar relatório (aba
          &quot;Vendas BR&quot;). Ele fica separado das vendas do Mercado Turbo: os dois medem os
          mesmos pedidos de formas diferentes, e este serve só ao calendário de repasses.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm text-muted file:mr-3 file:rounded file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-sm file:text-foreground"
        />
        <button
          type="submit"
          disabled={!file || uploading}
          className="rounded-md border border-gold px-4 py-2 text-sm text-gold transition hover:bg-gold hover:text-background disabled:cursor-not-allowed disabled:border-border disabled:text-muted disabled:hover:bg-transparent disabled:hover:text-muted"
        >
          {uploading ? "Importando..." : "Importar"}
        </button>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {result && (
        <p className="text-sm text-emerald-400">
          {result.totalRows.toLocaleString("pt-BR")} vendas lidas —{" "}
          {result.newSales.toLocaleString("pt-BR")} novas,{" "}
          {result.updatedSales.toLocaleString("pt-BR")} atualizadas,{" "}
          {result.withDeliveryDate.toLocaleString("pt-BR")} com data de entrega
          {result.skippedRows > 0 && `, ${result.skippedRows} linhas descartadas`}.
        </p>
      )}
    </form>
  );
}

export default function RecebiveisMlPage() {
  const [report, setReport] = useState<ReleaseReport | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // O efeito só dispara o fetch: o estado é atualizado na resposta, não no
  // corpo do efeito, que causaria uma cascata de renders. "Carregando" é
  // simplesmente `report` ainda nulo, sem uma flag própria pra manter em dia.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/mercadolivre-releases")
      .then((res) => res.json())
      .then((data: ReleaseReport) => {
        if (!cancelled) setReport(data);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function reload() {
    const res = await fetch("/api/mercadolivre-releases");
    setReport(await res.json());
  }

  async function handleSync() {
    setError(null);
    setSyncing(true);
    const res = await fetch("/api/mercadolivre-releases", { method: "POST" });
    if (!res.ok) {
      setSyncing(false);
      setError("Não foi possível aplicar os valores na projeção.");
      return;
    }
    await reload();
    setSyncing(false);
    setSynced(true);
  }

  if (!report) {
    return <p className="text-sm text-muted">Carregando...</p>;
  }

  const daReal = report.fonte === "mercado-pago";

  // Os totais somam o calendário inteiro, mas mostrar cada dia desde sempre não
  // ajuda a planejar caixa: com o dado real são meses de repasses já liberados,
  // e a barra de hoje some no meio deles. Gráfico e tabela ficam com os últimos
  // dias mais tudo que ainda vai cair.
  const diasVisiveis = report.days.filter((d) => d.date >= report.janelaInicio);
  const diasOcultos = report.days.length - diasVisiveis.length;
  const comAno = new Set(diasVisiveis.map((d) => d.date.slice(0, 4))).size > 1;

  // O cálculo só enxerga o que a fonte já viu. Na planilha, vendas feitas
  // depois da exportação não estão nela; no hub, é o sync que pode ter parado.
  // Nos dois casos, aplicar apagaria recebíveis que existem de verdade.
  const isStale = report.daysSinceLastSale !== null && report.daysSinceLastSale > 2;

  const bucketsMatch =
    report.buckets.today === report.saved.today &&
    report.buckets.tomorrow === report.saved.tomorrow &&
    report.buckets.within7d === report.saved.within7d &&
    report.buckets.after7d === report.saved.after7d;

  const bucketRows: { label: string; calculated: number; saved: number }[] = [
    { label: "Hoje", calculated: report.buckets.today, saved: report.saved.today },
    { label: "Amanhã", calculated: report.buckets.tomorrow, saved: report.saved.tomorrow },
    { label: "Até 7 dias", calculated: report.buckets.within7d, saved: report.saved.within7d },
    { label: "Depois de 7 dias", calculated: report.buckets.after7d, saved: report.saved.after7d },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-foreground">Recebíveis Mercado Livre</h1>
          <p className="text-sm text-muted">
            {daReal
              ? "Quando cada venda vira dinheiro na conta, pela data de repasse do Mercado Pago."
              : "Quando cada venda vira dinheiro na conta, estimado a partir da data de entrega."}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span
              className={`rounded-full px-2 py-0.5 ${
                daReal
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-amber-400/15 text-amber-300"
              }`}
            >
              {daReal ? "data real · Mercado Pago" : "estimativa · planilha"}
            </span>
            {daReal
              ? report.ultimaSincronizacao && (
                  <span>
                    hub sincronizado em{" "}
                    {new Date(report.ultimaSincronizacao).toLocaleString("pt-BR")}
                  </span>
                )
              : report.firstSaleDate &&
                report.lastSaleDate && (
                  <span>
                    vendas de {formatDay(report.firstSaleDate)} a {formatDay(report.lastSaleDate)}
                    {report.lastImportedAt &&
                      ` · importado em ${new Date(report.lastImportedAt).toLocaleDateString("pt-BR")}`}
                  </span>
                )}
          </p>
        </div>
        <PrintButton />
      </div>

      {report.withDeliveryDate === 0 ? (
        daReal ? (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-6">
            <h2 className="font-serif text-xl text-gold">O hub ainda não tem pagamentos</h2>
            <p className="max-w-prose text-sm text-muted">
              A conexão com o Holm Marketplace Hub está funcionando, mas nenhum pagamento do
              Mercado Pago foi sincronizado ainda. Rode o job <code>sync-pagamentos</code> no hub e
              volte aqui.
            </p>
          </div>
        ) : (
          <ImportPanel onImported={reload} compact={false} />
        )
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total das vendas"
              value={formatBRL(report.total)}
              note={`${report.salesCount.toLocaleString("pt-BR")} vendas, já sem tarifas`}
            />
            <StatCard
              label="Já liberado"
              value={formatBRL(report.releasedTotal)}
              note="deve estar no saldo das contas"
              tone="positive"
            />
            <StatCard
              label="A liberar com data"
              value={formatBRL(report.scheduledTotal)}
              note="entregue, dentro do prazo de repasse"
              tone="pending"
            />
            <StatCard
              label="Aguardando entrega"
              value={formatBRL(report.awaitingDelivery.amount)}
              note={`${report.awaitingDelivery.count} vendas, ainda sem data`}
              tone="pending"
            />
          </div>

          <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl text-foreground">Aplicar na projeção</h2>
                <p className="max-w-prose text-sm text-muted">
                  Estes são os quatro valores que a projeção de fluxo de caixa e o balanço
                  patrimonial usam, hoje preenchidos à mão em Início. Aplicar substitui os
                  valores salvos pelos calculados a partir das vendas importadas.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSync}
                disabled={syncing || bucketsMatch}
                className="shrink-0 rounded-md border border-gold px-4 py-2 text-sm text-gold transition hover:bg-gold hover:text-background disabled:cursor-not-allowed disabled:border-border disabled:text-muted disabled:hover:bg-transparent disabled:hover:text-muted"
              >
                {syncing ? "Aplicando..." : bucketsMatch ? "Já aplicado" : "Aplicar na projeção"}
              </button>
            </div>

            {isStale && (
              <p className="rounded-md border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-200">
                {daReal
                  ? `O hub não sincroniza os pagamentos há ${report.daysSinceLastSale} dias. Vendas pagas depois disso não estão neste cálculo — rode o sync-pagamentos no hub antes de aplicar.`
                  : `O relatório importado vai até ${formatDay(report.lastSaleDate!)} — ${report.daysSinceLastSale} dias atrás. As vendas feitas depois disso não estão neste cálculo, então aplicar agora tiraria da projeção recebíveis que existem. Exporte um relatório atualizado no Mercado Livre e importe antes de aplicar.`}
              </p>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}
            {synced && bucketsMatch && (
              <p className="text-sm text-emerald-400">
                Valores aplicados. A projeção de fluxo de caixa e o balanço já leem daqui.
              </p>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-md text-sm">
                <thead>
                  <tr className="border-b border-border text-xs tracking-wide text-muted uppercase">
                    <th className="py-2 text-left font-medium">Prazo</th>
                    <th className="py-2 text-right font-medium">Calculado</th>
                    <th className="py-2 text-right font-medium">Salvo hoje</th>
                  </tr>
                </thead>
                <tbody>
                  {bucketRows.map((row) => {
                    const differs = row.calculated !== row.saved;
                    return (
                      <tr key={row.label} className="border-b border-border/50 last:border-0">
                        <td className="py-2 text-muted">{row.label}</td>
                        <td className="py-2 text-right text-foreground tabular-nums">
                          {formatBRL(row.calculated)}
                        </td>
                        <td
                          className={`py-2 text-right tabular-nums ${differs ? "text-amber-300" : "text-muted"}`}
                        >
                          {formatBRL(row.saved)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted">
              Devolução e mediação em aberto ({formatBRL(report.atRisk.amount)} em{" "}
              {report.atRisk.count} vendas) ficam de fora dos quatro valores — podem virar
              reembolso ao comprador em vez de entrar no caixa.
            </p>
          </section>

          <ReleaseChart days={diasVisiveis} comAno={comAno} />

          <section className="flex flex-col gap-3">
            <h2 className="font-serif text-xl text-foreground">Dia a dia</h2>
            {diasOcultos > 0 && (
              <p className="text-sm text-muted">
                Últimos {report.diasDeHistorico} dias e tudo que ainda vai cair. Outros {diasOcultos}{" "}
                dias de repasses já liberados ficam de fora da lista, mas continuam somados nos
                totais e no acumulado.
              </p>
            )}
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-2xl text-sm">
                <thead className="bg-surface">
                  <tr className="text-xs tracking-wide text-muted uppercase">
                    <th className="px-4 py-3 text-left font-medium">Repasse</th>
                    <th className="px-4 py-3 text-right font-medium">Vendas</th>
                    <th className="px-4 py-3 text-right font-medium">Valor</th>
                    <th className="px-4 py-3 text-right font-medium">Acumulado</th>
                    <th className="px-4 py-3 text-left font-medium">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {diasVisiveis.map((d) => (
                    <tr key={d.date} className="border-t border-border">
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className="text-foreground">{formatDay(d.date, comAno)}</span>{" "}
                        <span className="text-xs text-muted">{formatWeekday(d.date)}</span>
                      </td>
                      <td className="px-4 py-2 text-right text-muted tabular-nums">{d.count}</td>
                      <td className="px-4 py-2 text-right text-foreground tabular-nums">
                        {formatBRL(d.amount)}
                      </td>
                      <td className="px-4 py-2 text-right text-muted tabular-nums">
                        {formatBRL(d.cumulative)}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            d.released
                              ? "bg-emerald-500/15 text-emerald-400"
                              : "bg-amber-400/15 text-amber-300"
                          }`}
                        >
                          {d.released ? "liberado" : "a liberar"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {!daReal && <ImportPanel onImported={reload} compact />}

          {daReal ? (
            <p className="max-w-prose text-xs text-muted">
              A data do repasse é a real: vem de <code>money_release_date</code>, na API do Mercado
              Pago, lida pelo Holm Marketplace Hub — {report.salesCount.toLocaleString("pt-BR")}{" "}
              pagamentos na base. Os valores são o líquido de fato repassado, já sem as tarifas de
              venda e de envio. Pagamentos em mediação ficam de fora dos quatro valores da projeção
              porque podem virar reembolso.
            </p>
          ) : (
            <p className="max-w-prose text-xs text-muted">
              <strong className="text-amber-300">Esta é uma estimativa</strong>, não a data real:{" "}
              {report.motivoFallback}. O relatório de vendas do Mercado Livre traz a data de
              entrega, não a do repasse, então somamos {report.releaseDelayDays} dias à entrega. Na
              prática o prazo é bem maior — medido nesta conta pela API do Mercado Pago: mediana de
              10 dias, máximo 60. Com o hub ligado, esta tela passa a usar a data real. Vendas
              canceladas ou zeradas ({report.noCashCount}{" "}
              {report.noCashCount === 1 ? "venda" : "vendas"}) não entram em nenhum total.
            </p>
          )}
        </>
      )}
    </div>
  );
}
