"use client";

import { useEffect, useState, type FormEvent } from "react";
import { formatBRL } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";

type Section = "ATIVO_CIRCULANTE" | "ATIVO_NAO_CIRCULANTE" | "PASSIVO_CIRCULANTE" | "PASSIVO_NAO_CIRCULANTE" | "PATRIMONIO_LIQUIDO";

type Line = { label: string; amount: number };
type SectionTotals = { lines: Line[]; total: number };

type CategoryBreakdown = { name: string; total: number };

type Report = {
  ativoCirculante: SectionTotals;
  ativoNaoCirculante: SectionTotals;
  ativoTotal: number;
  passivoCirculante: SectionTotals;
  passivoNaoCirculante: SectionTotals;
  passivoTotal: number;
  patrimonioLiquido: number;
  capitalSocial: number;
  lucrosAcumulados: number;
  breakdowns: Record<string, CategoryBreakdown[]>;
  generatedAt: string;
};

type Item = {
  id: string;
  section: Section;
  description: string;
  amount: string;
  isActive: boolean;
};

const SECTION_LABEL: Record<Section, string> = {
  ATIVO_CIRCULANTE: "Ativo Circulante",
  ATIVO_NAO_CIRCULANTE: "Ativo Não Circulante",
  PASSIVO_CIRCULANTE: "Passivo Circulante",
  PASSIVO_NAO_CIRCULANTE: "Passivo Não Circulante",
  PATRIMONIO_LIQUIDO: "Patrimônio Líquido",
};

function SectionCard({
  title,
  helpText,
  section,
  tone,
  breakdowns,
  expandedLine,
  onToggleLine,
}: {
  title: string;
  helpText: string;
  section: SectionTotals;
  tone: "positive" | "negative";
  breakdowns: Record<string, CategoryBreakdown[]>;
  expandedLine: string | null;
  onToggleLine: (label: string) => void;
}) {
  const toneClass = tone === "positive" ? "text-emerald-400" : "text-red-400";
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between border-b border-border/50 pb-2">
        <div>
          <h2 className="font-serif text-base text-foreground">{title}</h2>
          <p className="text-xs text-muted">{helpText}</p>
        </div>
        <span className={`font-serif text-lg ${toneClass}`}>{formatBRL(section.total)}</span>
      </div>
      {section.lines.length === 0 ? (
        <p className="pt-2 text-sm text-muted">Nada cadastrado ainda.</p>
      ) : (
        <div className="flex flex-col gap-1 pt-2">
          {section.lines.map((line, idx) => {
            const detail = breakdowns[line.label];
            const hasDetail = detail && detail.length > 0;
            const isExpanded = expandedLine === line.label;
            return (
              <div key={idx}>
                {hasDetail ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onToggleLine(line.label)}
                      className="no-print flex w-full items-center justify-between text-sm hover:text-gold"
                    >
                      <span className="text-muted">
                        {line.label} {isExpanded ? "▾" : "▸"}
                      </span>
                      <span className="text-foreground">{formatBRL(line.amount)}</span>
                    </button>
                    <div className="hidden justify-between text-sm print:flex">
                      <span className="text-muted">{line.label}</span>
                      <span className="text-foreground">{formatBRL(line.amount)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">{line.label}</span>
                    <span className="text-foreground">{formatBRL(line.amount)}</span>
                  </div>
                )}
                {hasDetail && isExpanded && (
                  <div className="mt-1 mb-1 flex flex-col gap-0.5 border-l border-border/50 pl-3">
                    {detail!.map((d, dIdx) => (
                      <div key={dIdx} className="flex justify-between text-xs text-muted">
                        <span>{d.name}</span>
                        <span>{formatBRL(d.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function BalancoPatrimonialPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLine, setExpandedLine] = useState<string | null>(null);

  const [section, setSection] = useState<Section>("ATIVO_CIRCULANTE");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [reportRes, itemsRes] = await Promise.all([
      fetch("/api/balance-sheet"),
      fetch("/api/balance-sheet-items"),
    ]);
    setReport(await reportRes.json());
    setItems((await itemsRes.json()).filter((i: Item) => i.isActive));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/balance-sheet-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section, description, amount }),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(typeof body.error === "string" ? body.error : "Não foi possível salvar.");
      setSubmitting(false);
      return;
    }
    setDescription("");
    setAmount("");
    setSubmitting(false);
    await load();
  }

  async function handleRemove(id: string) {
    if (!confirm("Remover esse item do balanço?")) return;
    await fetch(`/api/balance-sheet-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
    await load();
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-foreground">Balanço Patrimonial</h1>
          <p className="no-print text-sm text-muted">
            Uma foto de agora: tudo que a empresa tem, tudo que ela deve, e o que sobra pros sócios.
            Diferente do DRE, que mostra o resultado de um mês só.
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="no-print rounded-lg border border-gold/40 bg-gold/10 p-4 text-sm text-foreground">
        <p className="mb-1">
          <strong>Ativo</strong> = tudo que a empresa <strong>tem</strong> (dinheiro, a receber,
          estoque, máquinas).
        </p>
        <p className="mb-1">
          <strong>Passivo</strong> = tudo que a empresa <strong>deve</strong> (contas a pagar,
          empréstimos).
        </p>
        <p>
          <strong>Patrimônio Líquido</strong> = Ativo − Passivo = o que sobraria pros sócios se a
          empresa pagasse tudo que deve hoje.
        </p>
      </div>

      {loading || !report ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : (
        <>
          <div>
            <h2 className="mb-3 font-serif text-xl text-foreground">Ativo</h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <SectionCard
                title="1. Ativo Circulante"
                helpText="Vira dinheiro em até 12 meses: saldo em conta, a receber, estoque."
                section={report.ativoCirculante}
                tone="positive"
                breakdowns={report.breakdowns}
                expandedLine={expandedLine}
                onToggleLine={(l) => setExpandedLine(expandedLine === l ? null : l)}
              />
              <SectionCard
                title="2. Ativo Não Circulante"
                helpText="Fica na empresa por mais tempo: máquinas, equipamentos, investimentos."
                section={report.ativoNaoCirculante}
                tone="positive"
                breakdowns={report.breakdowns}
                expandedLine={expandedLine}
                onToggleLine={(l) => setExpandedLine(expandedLine === l ? null : l)}
              />
            </div>
            <p className="mt-2 text-right text-sm text-muted">
              Ativo Total: <span className="font-medium text-foreground">{formatBRL(report.ativoTotal)}</span>
            </p>
          </div>

          <div>
            <h2 className="mb-3 font-serif text-xl text-foreground">Passivo</h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <SectionCard
                title="3. Passivo Circulante"
                helpText="Vence em até 12 meses: contas a pagar."
                section={report.passivoCirculante}
                tone="negative"
                breakdowns={report.breakdowns}
                expandedLine={expandedLine}
                onToggleLine={(l) => setExpandedLine(expandedLine === l ? null : l)}
              />
              <SectionCard
                title="4. Passivo Não Circulante"
                helpText="Vence depois de 12 meses: saldo devedor de empréstimos (uma parte pode vencer antes — veja com seu contador se quiser separar)."
                section={report.passivoNaoCirculante}
                tone="negative"
                breakdowns={report.breakdowns}
                expandedLine={expandedLine}
                onToggleLine={(l) => setExpandedLine(expandedLine === l ? null : l)}
              />
            </div>
            <p className="mt-2 text-right text-sm text-muted">
              Passivo Total: <span className="font-medium text-foreground">{formatBRL(report.passivoTotal)}</span>
            </p>
          </div>

          <div className="rounded-lg border border-gold/40 bg-gold/10 p-4">
            <h2 className="mb-1 font-serif text-lg text-foreground">5. Patrimônio Líquido</h2>
            <p className="mb-3 text-xs text-muted">
              Calculado como Ativo Total − Passivo Total — não é uma soma de lançamentos contábeis
              (o sistema não é um livro de partida dobrada), é o jeito honesto de fechar a conta com
              os dados que existem.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <span className="block text-xs font-medium tracking-wide text-muted uppercase">
                  Capital Social
                </span>
                <span className="font-serif text-xl text-foreground">{formatBRL(report.capitalSocial)}</span>
                <p className="text-xs text-muted">O que os sócios investiram (cadastre abaixo).</p>
              </div>
              <div>
                <span className="block text-xs font-medium tracking-wide text-muted uppercase">
                  Lucros/Prejuízos Acumulados
                </span>
                <span
                  className={`font-serif text-xl ${report.lucrosAcumulados >= 0 ? "text-emerald-400" : "text-red-400"}`}
                >
                  {formatBRL(report.lucrosAcumulados)}
                </span>
                <p className="text-xs text-muted">O que a empresa gerou (ou perdeu) além do capital.</p>
              </div>
              <div>
                <span className="block text-xs font-medium tracking-wide text-muted uppercase">
                  Patrimônio Líquido
                </span>
                <span className="font-serif text-2xl text-gold">{formatBRL(report.patrimonioLiquido)}</span>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="no-print flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4"
          >
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted">Seção</label>
              <select
                value={section}
                onChange={(e) => setSection(e.target.value as Section)}
                className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
              >
                {(Object.keys(SECTION_LABEL) as Section[]).map((s) => (
                  <option key={s} value={s}>
                    {SECTION_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted">
                Descrição (ex.: Estoque, Máquina de costura, Capital Social)
              </label>
              <input
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-64 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted">Valor</label>
              <input
                required
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-32 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-gold px-4 py-1.5 text-sm font-medium text-black transition hover:bg-gold-soft disabled:opacity-50"
            >
              {submitting ? "Salvando..." : "Adicionar item"}
            </button>
            {error && <p className="w-full text-sm text-red-400">{error}</p>}
          </form>

          {items.length > 0 && (
            <div className="no-print flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
              <h2 className="font-serif text-lg text-foreground">Itens cadastrados manualmente</h2>
              <ul className="flex flex-col gap-1 text-sm">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between border-b border-border/50 py-1.5"
                  >
                    <div>
                      <span className="mr-2 rounded bg-gold/20 px-2 py-0.5 text-xs font-medium text-gold">
                        {SECTION_LABEL[item.section]}
                      </span>
                      <span className="text-foreground">{item.description}</span>
                      <span className="ml-2 text-muted">{formatBRL(item.amount)}</span>
                    </div>
                    <button
                      onClick={() => handleRemove(item.id)}
                      className="text-xs font-medium text-red-400 hover:underline"
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
