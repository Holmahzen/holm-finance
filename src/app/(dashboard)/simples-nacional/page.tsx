"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatBRL } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";

type AlertLevel = "ok" | "atencao" | "critico";

type MonthlyRevenue = { year: number; month: number; revenue: number; source: "notas" | "dre" };

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
  sources: { notas: number; dre: number };
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

function ProgressBar({ percent, colorClass }: { percent: number; colorClass: string }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-background">
      <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${clamped}%` }} />
    </div>
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
        <strong className="text-foreground">Como isso é calculado:</strong> mês com notas de venda
        importadas em <Link href="/notas-fiscais" className="text-gold-soft underline underline-offset-2">Notas
        Fiscais</Link> usa o faturamento das notas — vendas menos devoluções, pela data de emissão, que é a
        base do Simples. Mês sem notas usa a DRE, que só registra o dinheiro que entrou no banco: nas vendas
        do Mercado Livre isso é o repasse, já sem as tarifas, então fica bem abaixo do faturamento real. Use
        como alerta antecipado e confirme o enquadramento exato com seu contador antes de qualquer decisão.
      </div>

      {loading || !report ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : (
        <>
          <div className={`rounded-lg border p-4 ${ALERT_STYLES[report.alertLevel].border} ${ALERT_STYLES[report.alertLevel].bg}`}>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className={`text-xs font-medium tracking-wide uppercase ${ALERT_STYLES[report.alertLevel].text}`}>
                  RBT12 (receita bruta dos últimos 12 meses)
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
              {report.sources.notas === 0 ? (
                <>Nenhum dos 12 meses tem notas de venda importadas, então tudo aqui vem da DRE</>
              ) : (
                <>
                  {report.sources.dre} dos 12 meses ainda {report.sources.dre === 1 ? "vem" : "vêm"} da DRE
                  (marcados abaixo)
                </>
              )}{" "}
              e a receita dos últimos 12 meses está <strong className="text-amber-300">abaixo do real</strong>.
              Importe os XMLs das notas de venda desses meses em{" "}
              <Link href="/notas-fiscais" className="text-amber-300 underline underline-offset-2">
                Notas Fiscais
              </Link>{" "}
              — o valor aqui atualiza sozinho.
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
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          m.source === "notas"
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-amber-400/15 text-amber-300"
                        }`}
                        title={
                          m.source === "notas"
                            ? "Faturamento pelas notas fiscais de venda importadas"
                            : "Sem notas importadas: dinheiro que entrou no banco, pela DRE"
                        }
                      >
                        {m.source === "notas" ? "notas" : "DRE"}
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
