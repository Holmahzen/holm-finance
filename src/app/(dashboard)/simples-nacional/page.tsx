"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { formatBRL } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";

type AlertLevel = "ok" | "atencao" | "critico";

type RevenueSource = "pgdas" | "notas" | "dre";

type MonthlyRevenue = { year: number; month: number; revenue: number; source: RevenueSource };

type Taxes = {
  irpj: number;
  csll: number;
  cofins: number;
  pis: number;
  cpp: number;
  icms: number;
  ipi: number;
  iss: number;
  total: number;
};

type Apuracao = {
  period: string;
  rectifying: boolean;
  revenue: number;
  rbt12: number;
  rba: number;
  sublimit: number | null;
  icmsBlocked: boolean | null;
  taxes: Taxes;
  activities: { kind: string; description: string; revenue: number; taxes: Record<string, number> }[];
  dasDueDate: string | null;
  dasPaid: boolean | null;
};

type Report = {
  period: { year: number; month: number };
  ceiling: number;
  sublimit: number;
  monthlyRevenues: MonthlyRevenue[];
  rbt12: number;
  rbt12PercentOfCeiling: number;
  rbt12RemainingToCeiling: number;
  yearToDate: number;
  yearToDatePercentOfCeiling: number;
  projectedYearEnd: number | null;
  projectedYearEndPercentOfCeiling: number | null;
  alertLevel: AlertLevel;
  sources: { pgdas: number; notas: number; dre: number };
  official: {
    period: string;
    rbt12: number;
    rba: number;
    sublimit: number | null;
    icmsBlocked: boolean | null;
  } | null;
  apuracoes: Apuracao[];
};

type ImportResult = {
  files: number;
  imported: { period: string; revenue: number; total: number; rectifying: boolean }[];
  ignored: { file: string; reason: string }[];
};

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const ALERT_STYLES: Record<AlertLevel, { border: string; bg: string; text: string; bar: string }> = {
  ok: { border: "border-gold/40", bg: "bg-gold/10", text: "text-gold", bar: "bg-gold" },
  atencao: { border: "border-amber-400/40", bg: "bg-amber-400/10", text: "text-amber-400", bar: "bg-amber-400" },
  critico: { border: "border-red-400/40", bg: "bg-red-400/10", text: "text-red-400", bar: "bg-red-400" },
};

const ALERT_LABEL: Record<AlertLevel, string> = {
  ok: "Dentro do esperado",
  atencao: "Atenção — chegando perto do teto",
  critico: "Crítico — muito perto ou acima do teto",
};

const SOURCE_BADGE: Record<RevenueSource, { label: string; className: string; title: string }> = {
  pgdas: {
    label: "PGDAS",
    className: "bg-gold/20 text-gold",
    title: "Faturamento declarado no extrato do PGDAS-D — o número oficial",
  },
  notas: {
    label: "notas",
    className: "bg-emerald-500/15 text-emerald-400",
    title: "Faturamento pelas notas fiscais de venda importadas",
  },
  dre: {
    label: "DRE",
    className: "bg-amber-400/15 text-amber-300",
    title: "Sem extrato nem notas: dinheiro que entrou no banco, pela DRE",
  },
};

/** "2026-08" → "agosto/2026". */
function periodLabel(period: string): string {
  const [year, month] = period.split("-");
  return `${MONTHS[Number(month) - 1]}/${year}`;
}

function formatDay(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function pct(fraction: number): string {
  return `${(fraction * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function ProgressBar({ percent, colorClass }: { percent: number; colorClass: string }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-background">
      <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

function PgdasImportPanel({ onImported }: { onImported: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    setResult(null);
    const payload = await Promise.all(
      files.map(async (f) => ({ name: f.name, base64: toBase64(new Uint8Array(await f.arrayBuffer())) })),
    );
    const res = await fetch("/api/imports/pgdas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: payload }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.error ?? "Não foi possível importar os extratos.");
      return;
    }
    setResult(body as ImportResult);
    onImported();
  }

  return (
    <form onSubmit={handleSubmit} className="no-print flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div>
        <h2 className="text-xs font-medium tracking-wide text-muted uppercase">Importar extratos do PGDAS-D</h2>
        <p className="max-w-prose text-sm text-muted">
          O PDF &quot;Extrato do Simples Nacional&quot; de cada mês traz o faturamento oficial, a receita dos
          últimos 12 meses e o DAS separado por tributo. Pode mandar vários meses de uma vez; importar de novo
          (ou a declaração retificadora) substitui o mês.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept=".pdf"
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
      {error && <p className="text-sm text-red-400">{error}</p>}
      {result && (
        <div className="flex flex-col gap-1 text-sm">
          {result.imported.length > 0 && (
            <p className="text-emerald-400">
              {result.imported.length} {result.imported.length === 1 ? "extrato importado" : "extratos importados"}:{" "}
              {result.imported
                .map((i) => `${periodLabel(i.period)} (DAS ${formatBRL(i.total)}${i.rectifying ? ", retificadora" : ""})`)
                .join(", ")}
              .
            </p>
          )}
          {result.ignored.map((i) => (
            <p key={i.file} className="text-amber-300">
              Ignorado — {i.file}: {i.reason}
            </p>
          ))}
        </div>
      )}
    </form>
  );
}

export default function SimplesNacionalPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/simples-nacional")
      .then((res) => res.json())
      .then((data) => {
        setReport(data);
        setLoading(false);
      });
  }, []);

  async function reload() {
    const res = await fetch("/api/simples-nacional");
    setReport(await res.json());
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-foreground">Simples Nacional</h1>
          <p className="no-print text-sm text-muted">
            Acompanha o quanto a receita bruta acumulada está perto do teto anual do Simples
            Nacional, pra não ser pega de surpresa com o desenquadramento.
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="rounded-lg border border-border bg-surface p-4 text-xs text-muted">
        <strong className="text-foreground">Como isso é calculado:</strong> cada mês usa a fonte mais
        confiável que houver. Primeiro o <strong className="text-foreground">extrato do PGDAS-D</strong>,
        que é o faturamento oficial declarado. Sem extrato, as notas de venda importadas em{" "}
        <Link href="/notas-fiscais" className="text-gold-soft underline underline-offset-2">
          Notas Fiscais
        </Link>{" "}
        — vendas menos devoluções, pela data de emissão. Sem nenhum dos dois, a DRE, que só registra o dinheiro
        que entrou no banco e fica bem abaixo do faturamento real. Use como alerta antecipado e confirme o
        enquadramento exato com seu contador antes de qualquer decisão.
      </div>

      <PgdasImportPanel onImported={reload} />

      {loading || !report ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : (
        <>
          {report.official && (
            <div className="rounded-lg border border-gold/40 bg-surface p-4">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <span className="text-xs font-medium tracking-wide text-gold uppercase">
                    RBT12 oficial — apuração de {periodLabel(report.official.period)}
                  </span>
                  <p className="font-serif text-3xl text-gold">{formatBRL(report.official.rbt12)}</p>
                  <p className="text-xs text-muted">
                    Receita dos 12 meses anteriores a {periodLabel(report.official.period)}, como está no extrato
                    do PGDAS-D. É esse número que define a faixa do Simples.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-medium tracking-wide text-muted uppercase">
                    Faturado no ano (oficial)
                  </span>
                  <p className="font-serif text-2xl text-foreground">{formatBRL(report.official.rba)}</p>
                  <p className="text-xs text-muted">
                    {(report.official.rba / report.ceiling * 100).toFixed(1)}% do teto
                  </p>
                </div>
              </div>
              {report.official.sublimit != null && report.official.rbt12 > report.official.sublimit && (
                <p className="mt-3 rounded-md border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-100">
                  Passou do sublimite de {formatBRL(report.official.sublimit)}.{" "}
                  {report.official.icmsBlocked
                    ? "O extrato já diz que a empresa está impedida de recolher ICMS no DAS: ele passa a ser pago por guia estadual."
                    : "O extrato ainda diz que o ICMS continua no DAS — pela regra, o impedimento costuma valer a partir de janeiro do ano seguinte. Confirme com o contador."}
                </p>
              )}
            </div>
          )}

          <div className={`rounded-lg border p-4 ${ALERT_STYLES[report.alertLevel].border} ${ALERT_STYLES[report.alertLevel].bg}`}>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className={`text-xs font-medium tracking-wide uppercase ${ALERT_STYLES[report.alertLevel].text}`}>
                  Receita dos últimos 12 meses (inclui o mês em andamento)
                </span>
                <p className={`font-serif text-3xl ${ALERT_STYLES[report.alertLevel].text}`}>
                  {formatBRL(report.rbt12)}
                </p>
              </div>
              <div className="text-right">
                <span className={`text-xs font-medium tracking-wide uppercase ${ALERT_STYLES[report.alertLevel].text}`}>
                  {ALERT_LABEL[report.alertLevel]}
                </span>
                <p className={`font-serif text-3xl ${ALERT_STYLES[report.alertLevel].text}`}>
                  {report.rbt12PercentOfCeiling.toFixed(1)}%
                </p>
              </div>
            </div>
            <div className="mt-3">
              <ProgressBar percent={report.rbt12PercentOfCeiling} colorClass={ALERT_STYLES[report.alertLevel].bar} />
            </div>
            <p className="mt-2 text-xs text-muted">
              Teto do Simples Nacional: {formatBRL(report.ceiling)}/ano · Falta{" "}
              {formatBRL(Math.max(0, report.rbt12RemainingToCeiling))} pra chegar lá · Sublimite de
              recolhimento de ICMS/ISS (não tira do Simples): {formatBRL(report.sublimit)}
            </p>
          </div>

          {report.sources.dre > 0 && (
            <div className="no-print rounded-lg border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-100">
              {report.sources.dre} dos 12 meses ainda {report.sources.dre === 1 ? "vem" : "vêm"} da DRE (marcados
              abaixo), e a receita dos últimos 12 meses está <strong className="text-amber-300">abaixo do real</strong>.
              Importe o extrato do PGDAS-D desses meses aqui em cima, ou as notas de venda em{" "}
              <Link href="/notas-fiscais" className="text-amber-300 underline underline-offset-2">
                Notas Fiscais
              </Link>{" "}
              — o valor atualiza sozinho.
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
              <div>
                <h2 className="font-serif text-lg text-foreground">
                  Acumulado no ano ({report.period.year})
                </h2>
                <p className="text-xs text-muted">
                  Receita bruta de janeiro até {MONTHS[report.period.month - 1]}/{report.period.year}.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs font-medium tracking-wide text-muted uppercase">
                    Faturado no ano
                  </span>
                  <span className="font-serif text-2xl text-gold">{formatBRL(report.yearToDate)}</span>
                </div>
                <div>
                  <span className="block text-xs font-medium tracking-wide text-muted uppercase">
                    % do teto
                  </span>
                  <span className="font-serif text-2xl text-foreground">
                    {report.yearToDatePercentOfCeiling.toFixed(1)}%
                  </span>
                </div>
              </div>
              <ProgressBar percent={report.yearToDatePercentOfCeiling} colorClass="bg-gold" />
            </div>

            <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
              <div>
                <h2 className="font-serif text-lg text-foreground">Projeção de fechamento do ano</h2>
                <p className="text-xs text-muted">
                  No ritmo médio dos últimos 3 meses fechados, somado ao que já foi faturado esse ano.
                </p>
              </div>
              {report.projectedYearEnd === null ? (
                <p className="text-sm text-muted">Ainda não há meses fechados suficientes pra estimar.</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="block text-xs font-medium tracking-wide text-muted uppercase">
                        Projeção pra dezembro
                      </span>
                      <span className="font-serif text-2xl text-gold">
                        {formatBRL(report.projectedYearEnd)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs font-medium tracking-wide text-muted uppercase">
                        % do teto
                      </span>
                      <span className="font-serif text-2xl text-foreground">
                        {report.projectedYearEndPercentOfCeiling?.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <ProgressBar
                    percent={report.projectedYearEndPercentOfCeiling ?? 0}
                    colorClass={
                      (report.projectedYearEndPercentOfCeiling ?? 0) >= 95
                        ? "bg-red-400"
                        : (report.projectedYearEndPercentOfCeiling ?? 0) >= 80
                          ? "bg-amber-400"
                          : "bg-gold"
                    }
                  />
                </>
              )}
            </div>
          </div>

          {report.apuracoes.length > 0 && (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
              <h2 className="font-serif text-lg text-foreground">DAS por tributo (extratos do PGDAS-D)</h2>
              <p className="text-xs text-muted">
                O que foi apurado em cada mês, separado por tributo. ICMS e IPI ficam em destaque: são os que mudam
                de forma quando a empresa passa do sublimite ou sai do Simples.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-3xl text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted">
                      <th className="py-2 font-medium">Mês</th>
                      <th className="py-2 text-right font-medium">Receita</th>
                      <th className="py-2 text-right font-medium">DAS</th>
                      <th className="py-2 text-right font-medium">% efetivo</th>
                      <th className="py-2 text-right font-medium">ICMS</th>
                      <th className="py-2 text-right font-medium">IPI</th>
                      <th className="py-2 text-right font-medium">INSS/CPP</th>
                      <th className="py-2 text-right font-medium">Federais*</th>
                      <th className="py-2 pl-4 font-medium">Vencimento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...report.apuracoes].reverse().map((a) => (
                      <tr key={a.period} className="border-b border-border/50">
                        <td className="py-2 text-foreground">
                          {periodLabel(a.period)}
                          {a.rectifying && <span className="ml-2 text-xs text-amber-300">retificadora</span>}
                        </td>
                        <td className="py-2 text-right tabular-nums text-foreground">{formatBRL(a.revenue)}</td>
                        <td className="py-2 text-right font-medium tabular-nums text-foreground">
                          {formatBRL(a.taxes.total)}
                        </td>
                        <td className="py-2 text-right tabular-nums text-muted">
                          {a.revenue > 0 ? pct(a.taxes.total / a.revenue) : "—"}
                        </td>
                        <td className="py-2 text-right tabular-nums text-gold">{formatBRL(a.taxes.icms)}</td>
                        <td className="py-2 text-right tabular-nums text-gold">{formatBRL(a.taxes.ipi)}</td>
                        <td className="py-2 text-right tabular-nums text-muted">{formatBRL(a.taxes.cpp)}</td>
                        <td className="py-2 text-right tabular-nums text-muted">
                          {formatBRL(a.taxes.irpj + a.taxes.csll + a.taxes.cofins + a.taxes.pis)}
                        </td>
                        <td className="py-2 pl-4 text-muted">{a.dasDueDate ? formatDay(a.dasDueDate) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted">
                * Federais = IRPJ + CSLL + COFINS + PIS. O extrato é uma foto do dia em que foi gerado: ele não diz
                se o DAS foi pago depois.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
            <h2 className="font-serif text-lg text-foreground">Receita mês a mês (últimos 12 meses)</h2>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted">
                  <th className="py-2 font-medium">Mês</th>
                  <th className="py-2 font-medium">Receita bruta</th>
                  <th className="py-2 font-medium">Fonte</th>
                </tr>
              </thead>
              <tbody>
                {report.monthlyRevenues.map((m) => (
                  <tr key={`${m.year}-${m.month}`} className="border-b border-border/50">
                    <td className="py-2 text-foreground">
                      {MONTHS[m.month - 1]}/{m.year}
                      {m.year === report.period.year && m.month === report.period.month && (
                        <span className="ml-2 rounded bg-gold/20 px-2 py-0.5 text-xs font-medium text-gold">
                          em andamento
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-foreground">{formatBRL(m.revenue)}</td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${SOURCE_BADGE[m.source].className}`}
                        title={SOURCE_BADGE[m.source].title}
                      >
                        {SOURCE_BADGE[m.source].label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
