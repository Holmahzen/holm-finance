"use client";

import { useEffect, useState } from "react";
import { formatBRL } from "@/lib/format";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

type DreLine = { categoryId: string; name: string; total: number };
type DreSection = { lines: DreLine[]; total: number };

type Dre = {
  period: { year: number; month: number };
  cogsMatchedSkus: number;
  cogsUnmatchedSkus: number;
  cogsCoveragePercent: number | null;
  cogsMinCoveragePercent: number;
  receitaBruta: DreSection;
  deducoes: DreSection;
  receitaLiquida: number;
  cmv: DreSection;
  custoVariavel: DreSection;
  custosVariaveisTotal: number;
  margemContribuicao: number;
  pessoal: DreSection;
  administrativa: DreSection;
  comercial: DreSection;
  produtiva: DreSection;
  despesasFixasTotal: number;
  resultadoOperacional: number;
  financeiroReceita: DreSection;
  financeiroDespesa: DreSection;
  resultadoFinanceiro: number;
  resultadoAntesImposto: number;
  naoOperacionalReceita: DreSection;
  naoOperacionalDespesa: DreSection;
  resultadoNaoOperacional: number;
  lucroLiquido: number;
};

const now = new Date();

function LineSection({
  number,
  title,
  section,
  tone,
  showZero,
}: {
  number: string;
  title: string;
  section: DreSection;
  tone: "positive" | "negative";
  showZero: boolean;
}) {
  const lines = showZero ? section.lines : section.lines.filter((l) => l.total !== 0);
  const toneClass = tone === "positive" ? "text-emerald-400" : "text-red-400";

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between border-b border-border/50 pb-2">
        <h2 className="font-serif text-base text-foreground">
          {number}. {title}
        </h2>
        <span className={`font-serif text-lg ${toneClass}`}>{formatBRL(section.total)}</span>
      </div>
      {lines.length === 0 ? (
        <p className="pt-2 text-sm text-muted">Nenhum valor no período.</p>
      ) : (
        <div className="flex flex-col gap-1 pt-2">
          {lines.map((l) => (
            <div key={l.categoryId} className="flex items-center justify-between text-sm">
              <span className="text-muted">{l.name}</span>
              <span className="text-foreground">{formatBRL(l.total)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SubSection({
  number,
  title,
  section,
  showZero,
}: {
  number: string;
  title: string;
  section: DreSection;
  showZero: boolean;
}) {
  const lines = showZero ? section.lines : section.lines.filter((l) => l.total !== 0);
  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">
          {number} {title}
        </h3>
        <span className="text-sm text-red-400">{formatBRL(section.total)}</span>
      </div>
      {lines.length > 0 && (
        <div className="mt-1 flex flex-col gap-1 pl-3">
          {lines.map((l) => (
            <div key={l.categoryId} className="flex items-center justify-between text-xs">
              <span className="text-muted">{l.name}</span>
              <span className="text-foreground">{formatBRL(l.total)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TotalRow({
  number,
  label,
  value,
  emphasis = false,
}: {
  number: string;
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  const toneClass = value >= 0 ? "text-emerald-400" : "text-red-400";
  return (
    <div
      className={`flex items-center justify-between rounded-lg border border-gold/40 bg-surface px-4 ${
        emphasis ? "py-4" : "py-3"
      }`}
    >
      <span className={`font-serif text-foreground ${emphasis ? "text-lg" : "text-base"}`}>
        {number}. {label}
      </span>
      <span className={`font-serif ${emphasis ? "text-2xl" : "text-xl"} ${toneClass}`}>
        {formatBRL(value)}
      </span>
    </div>
  );
}

const COMPARISON_ROWS: { number: string; label: string; key: keyof Dre; emphasis?: boolean }[] = [
  { number: "1", label: "Receita Bruta", key: "receitaBruta" },
  { number: "2", label: "Deduções da Receita", key: "deducoes" },
  { number: "3", label: "Receita Líquida", key: "receitaLiquida" },
  { number: "4", label: "Custos Variáveis (CMV + Outros)", key: "custosVariaveisTotal" },
  { number: "5", label: "Margem de Contribuição", key: "margemContribuicao" },
  { number: "6", label: "Despesas Operacionais Fixas", key: "despesasFixasTotal" },
  { number: "7", label: "Resultado Operacional", key: "resultadoOperacional" },
  { number: "8", label: "Resultado Financeiro", key: "resultadoFinanceiro" },
  { number: "9", label: "Resultado Antes do Imposto", key: "resultadoAntesImposto" },
  { number: "10", label: "Resultado Não Operacional", key: "resultadoNaoOperacional" },
  { number: "11", label: "Lucro ou Prejuízo Líquido", key: "lucroLiquido", emphasis: true },
];

function rowValue(dre: Dre, key: keyof Dre): number {
  const v = dre[key];
  return typeof v === "number" ? v : (v as DreSection).total;
}

function ComparisonTable({ reports }: { reports: Dre[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface p-4">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-muted">
            <th className="py-2 font-medium">Linha</th>
            {reports.map((r) => (
              <th key={`${r.period.year}-${r.period.month}`} className="py-2 text-right font-medium">
                {MONTHS[r.period.month - 1]}/{r.period.year}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARISON_ROWS.map((row) => (
            <tr
              key={row.key}
              className={`border-b border-border/50 ${row.emphasis ? "font-serif" : ""}`}
            >
              <td className={`py-2 ${row.emphasis ? "text-foreground" : "text-muted"}`}>
                {row.number}. {row.label}
              </td>
              {reports.map((r) => {
                const value = rowValue(r, row.key);
                return (
                  <td
                    key={`${r.period.year}-${r.period.month}`}
                    className={`py-2 text-right ${value >= 0 ? "text-emerald-400" : "text-red-400"} ${
                      row.emphasis ? "text-base font-medium" : ""
                    }`}
                  >
                    {formatBRL(value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DrePage() {
  const [year, setYear] = useState(now.getFullYear());
  const [selectedMonths, setSelectedMonths] = useState<number[]>([now.getMonth() + 1]);
  const [reports, setReports] = useState<Dre[]>([]);
  const [loading, setLoading] = useState(true);
  const [showZero, setShowZero] = useState(false);

  function toggleMonth(m: number) {
    setSelectedMonths((prev) => {
      if (prev.includes(m)) {
        if (prev.length === 1) return prev; // sempre pelo menos 1 mês selecionado
        return prev.filter((x) => x !== m);
      }
      return [...prev, m].sort((a, b) => a - b);
    });
  }

  useEffect(() => {
    setLoading(true);
    Promise.all(
      selectedMonths.map((m) => fetch(`/api/dre?year=${year}&month=${m}`).then((res) => res.json())),
    ).then((data) => {
      setReports(data);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, selectedMonths]);

  const dre = reports[0] ?? null;
  const isComparing = selectedMonths.length > 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-foreground">DRE</h1>
          <p className="text-sm text-muted">
            Demonstrativo de Resultado do Exercício, por regime de caixa (lançamentos pagos no
            período). Selecione mais de um mês pra comparar lado a lado.
          </p>
        </div>
        {!isComparing && (
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={showZero}
              onChange={(e) => setShowZero(e.target.checked)}
              className="accent-gold"
            />
            Mostrar linhas zeradas
          </label>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface px-4 py-2">
        <div className="flex items-center gap-1">
          <span className="mr-1 text-xs text-muted">Ano</span>
          {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setYear(y)}
              className={
                y === year
                  ? "rounded bg-gold px-2.5 py-1 text-xs font-medium text-black"
                  : "rounded px-2.5 py-1 text-xs font-medium text-muted transition hover:text-foreground"
              }
            >
              {y}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="mr-1 text-xs text-muted">Mês (clique pra somar mais de um)</span>
          {MONTHS.map((label, idx) => (
            <button
              key={label}
              type="button"
              onClick={() => toggleMonth(idx + 1)}
              className={
                selectedMonths.includes(idx + 1)
                  ? "rounded bg-gold px-2.5 py-1 text-xs font-medium text-black"
                  : "rounded px-2.5 py-1 text-xs font-medium text-muted transition hover:text-foreground"
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading || !dre ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : isComparing ? (
        <ComparisonTable reports={reports} />
      ) : (
        <div className="flex max-w-3xl flex-col gap-4">
          <LineSection
            number="1"
            title="Receita Bruta"
            section={dre.receitaBruta}
            tone="positive"
            showZero={showZero}
          />
          <LineSection
            number="2"
            title="Deduções da Receita"
            section={dre.deducoes}
            tone="negative"
            showZero={showZero}
          />
          <TotalRow number="3" label="Receita Líquida" value={dre.receitaLiquida} />
          <p className="text-xs text-muted">
            {dre.cogsCoveragePercent !== null &&
            dre.cogsCoveragePercent >= dre.cogsMinCoveragePercent
              ? "Tecido, Costura e Aviamentos abaixo já estão pelo custo das peças efetivamente vendidas no período (quantidade vendida × custo cadastrado em Produtos)."
              : `Tecido, Costura e Aviamentos abaixo ainda estão pelo valor pago no mês — ${
                  dre.cogsCoveragePercent !== null
                    ? `${dre.cogsCoveragePercent.toFixed(0)}% da quantidade vendida já tem custo cadastrado, `
                    : ""
                }faltam chegar a ${dre.cogsMinCoveragePercent}% pra a DRE trocar automaticamente pelo custo das peças vendidas. Cadastre o custo por peça em Produtos (com o SKU vendido).`}
          </p>
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <h2 className="font-serif text-base text-foreground">4. Custos Variáveis</h2>
              <span className="font-serif text-lg text-red-400">
                {formatBRL(dre.custosVariaveisTotal)}
              </span>
            </div>
            <SubSection number="4.1" title="CMV — Custo da Mercadoria Vendida" section={dre.cmv} showZero={showZero} />
            <SubSection
              number="4.2"
              title="Outras despesas variáveis de venda"
              section={dre.custoVariavel}
              showZero={showZero}
            />
          </div>
          <TotalRow number="5" label="Margem de Contribuição" value={dre.margemContribuicao} />

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <h2 className="font-serif text-base text-foreground">6. Despesas Operacionais Fixas</h2>
              <span className="font-serif text-lg text-red-400">
                {formatBRL(dre.despesasFixasTotal)}
              </span>
            </div>
            <SubSection number="6.1" title="Despesas com pessoal" section={dre.pessoal} showZero={showZero} />
            <SubSection
              number="6.2"
              title="Despesas administrativas"
              section={dre.administrativa}
              showZero={showZero}
            />
            <SubSection number="6.3" title="Despesas comerciais" section={dre.comercial} showZero={showZero} />
            <SubSection
              number="6.4"
              title="Despesas da estrutura produtiva"
              section={dre.produtiva}
              showZero={showZero}
            />
          </div>

          <TotalRow number="7" label="Resultado Operacional" value={dre.resultadoOperacional} />

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <h2 className="font-serif text-base text-foreground">8. Resultado Financeiro</h2>
              <span
                className={`font-serif text-lg ${dre.resultadoFinanceiro >= 0 ? "text-emerald-400" : "text-red-400"}`}
              >
                {formatBRL(dre.resultadoFinanceiro)}
              </span>
            </div>
            <SubSection
              number="+"
              title="Receitas financeiras"
              section={dre.financeiroReceita}
              showZero={showZero}
            />
            <SubSection
              number="-"
              title="Despesas financeiras"
              section={dre.financeiroDespesa}
              showZero={showZero}
            />
          </div>

          <TotalRow
            number="9"
            label="Resultado Antes do Imposto sobre o Lucro"
            value={dre.resultadoAntesImposto}
          />

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <h2 className="font-serif text-base text-foreground">
                10. Outras Receitas e Despesas Não Operacionais
              </h2>
              <span
                className={`font-serif text-lg ${dre.resultadoNaoOperacional >= 0 ? "text-emerald-400" : "text-red-400"}`}
              >
                {formatBRL(dre.resultadoNaoOperacional)}
              </span>
            </div>
            <SubSection
              number="+"
              title="Receitas não operacionais"
              section={dre.naoOperacionalReceita}
              showZero={showZero}
            />
            <SubSection
              number="-"
              title="Despesas não operacionais"
              section={dre.naoOperacionalDespesa}
              showZero={showZero}
            />
          </div>

          <TotalRow number="11" label="Lucro ou Prejuízo Líquido" value={dre.lucroLiquido} emphasis />
        </div>
      )}
    </div>
  );
}
