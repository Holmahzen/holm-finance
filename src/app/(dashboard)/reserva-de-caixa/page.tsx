"use client";

import { useEffect, useState, type FormEvent } from "react";
import { formatBRL } from "@/lib/format";
import { PrintButton } from "@/components/PrintButton";

type Provision = {
  yearTarget: number;
  monthlyAccrual: number;
  accruedSoFar: number;
  remainingThisYear: number;
  saved: number;
  dailyGoal: number;
};

type Contingency = {
  monthsOfCoverage: number;
  target: number;
  suggestedMonthlySaving: number;
  saved: number;
  dailyGoal: number;
};

type Tax = {
  ratePercent: number;
  monthlyRevenue: number;
  target: number;
  saved: number;
  dueDay: number;
  dueDate: string;
  daysUntilDue: number;
  dailyGoal: number;
};

type Report = {
  period: { year: number; month: number; monthsElapsed: number };
  monthlySalaries: number;
  totalMonthlyFixedCosts: number;
  daysRemainingInMonth: number;
  thirteenth: Provision;
  vacation: Provision;
  contingency: Contingency;
  tax: Tax;
  totalMonthlyRecommendedSaving: number;
  totalDailyGoal: number;
  eligibleFixedCosts: { id: string; description: string; monthlyAmount: number }[];
};

type ReserveCategory = "THIRTEENTH" | "VACATION" | "CONTINGENCY" | "TAX";

type Deposit = {
  id: string;
  category: ReserveCategory;
  amount: string;
  date: string;
  notes: string | null;
};

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const CATEGORY_LABEL: Record<ReserveCategory, string> = {
  THIRTEENTH: "13º salário",
  VACATION: "Férias",
  CONTINGENCY: "Imprevistos",
  TAX: "Impostos",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function todayLocalDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ProvisionCard({
  title,
  provision,
  helpText,
}: {
  title: string;
  provision: Provision;
  helpText: string;
}) {
  const progress = provision.yearTarget > 0 ? Math.min(100, (provision.saved / provision.yearTarget) * 100) : 0;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div>
        <h2 className="font-serif text-lg text-foreground">{title}</h2>
        <p className="text-xs text-muted">{helpText}</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="block text-xs font-medium tracking-wide text-muted uppercase">
            Guardado até agora
          </span>
          <span className="font-serif text-2xl text-gold">{formatBRL(provision.saved)}</span>
        </div>
        <div>
          <span className="block text-xs font-medium tracking-wide text-muted uppercase">
            Meta até dezembro
          </span>
          <span className="font-serif text-2xl text-foreground">{formatBRL(provision.yearTarget)}</span>
        </div>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-muted">
          <span>Ritmo recomendado até aqui: {formatBRL(provision.accruedSoFar)}</span>
          <span>{progress.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-background">
          <div className="h-full rounded-full bg-gold" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <p className="text-xs text-muted">
        Meta diária pra fechar o mês em dia:{" "}
        <span className="font-medium text-foreground">{formatBRL(provision.dailyGoal)}/dia</span>
      </p>
    </div>
  );
}

export default function CashReservePage() {
  const [report, setReport] = useState<Report | null>(null);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [contingencyMonths, setContingencyMonths] = useState(3);
  const [taxRateInput, setTaxRateInput] = useState("14");
  const [taxRatePercent, setTaxRatePercent] = useState(14);
  const [taxDueDayInput, setTaxDueDayInput] = useState("20");
  const [taxDueDay, setTaxDueDay] = useState(20);

  const [depositCategory, setDepositCategory] = useState<ReserveCategory>("THIRTEENTH");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositDate, setDepositDate] = useState(todayLocalDateString());
  const [depositNotes, setDepositNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(months: number, taxRate: number, dueDay: number) {
    setLoading(true);
    const [reportRes, depositsRes] = await Promise.all([
      fetch(
        `/api/cash-reserve?contingencyMonths=${months}&taxRatePercent=${taxRate}&taxDueDay=${dueDay}`,
      ),
      fetch("/api/reserve-deposits"),
    ]);
    setReport(await reportRes.json());
    setDeposits(await depositsRes.json());
    setLoading(false);
  }

  useEffect(() => {
    load(contingencyMonths, taxRatePercent, taxDueDay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contingencyMonths, taxRatePercent, taxDueDay]);

  function applyTaxRate() {
    const parsed = Number(taxRateInput.replace(",", "."));
    if (Number.isFinite(parsed) && parsed >= 0) {
      setTaxRatePercent(parsed);
    }
  }

  function applyTaxDueDay() {
    const parsed = Number(taxDueDayInput);
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 31) {
      setTaxDueDay(parsed);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/reserve-deposits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: depositCategory,
        amount: depositAmount,
        date: depositDate,
        notes: depositNotes || undefined,
      }),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(typeof body.error === "string" ? body.error : "Não foi possível salvar.");
      setSubmitting(false);
      return;
    }
    setDepositAmount("");
    setDepositNotes("");
    setSubmitting(false);
    await load(contingencyMonths, taxRatePercent, taxDueDay);
  }

  async function handleDeleteDeposit(id: string) {
    if (!confirm("Excluir esse registro de valor guardado?")) return;
    await fetch(`/api/reserve-deposits/${id}`, { method: "DELETE" });
    await load(contingencyMonths, taxRatePercent, taxDueDay);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-foreground">Reserva de Caixa</h1>
          <p className="no-print text-sm text-muted">
            Quanto guardar todo mês pra não ser pega de surpresa com 13º, férias da equipe e
            imprevistos — e quanto você já guardou de verdade, registrando aqui.
          </p>
        </div>
        <PrintButton />
      </div>

      <form
        onSubmit={handleSubmit}
        className="no-print flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Guardei pra</label>
          <select
            value={depositCategory}
            onChange={(e) => setDepositCategory(e.target.value as ReserveCategory)}
            className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          >
            <option value="THIRTEENTH">13º salário</option>
            <option value="VACATION">Férias</option>
            <option value="CONTINGENCY">Imprevistos</option>
            <option value="TAX">Impostos</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Valor</label>
          <input
            required
            type="number"
            step="0.01"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            className="w-32 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Data</label>
          <input
            required
            type="date"
            value={depositDate}
            onChange={(e) => setDepositDate(e.target.value)}
            className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted">Nota (opcional)</label>
          <input
            value={depositNotes}
            onChange={(e) => setDepositNotes(e.target.value)}
            placeholder="Ex.: transferi pra conta reserva"
            className="w-56 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-gold px-4 py-1.5 text-sm font-medium text-black transition hover:bg-gold-soft disabled:opacity-50"
        >
          {submitting ? "Salvando..." : "Registrar valor guardado"}
        </button>
        {error && <p className="w-full text-sm text-red-400">{error}</p>}
      </form>

      {loading || !report ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : (
        <>
          <div className="rounded-lg border border-gold/40 bg-gold/10 p-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <span className="text-xs font-medium tracking-wide text-gold uppercase">
                  Recomendado guardar por mês
                </span>
                <p className="font-serif text-3xl text-gold">
                  {formatBRL(report.totalMonthlyRecommendedSaving)}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-medium tracking-wide text-gold uppercase">
                  Meta diária ({report.daysRemainingInMonth} dia(s) restantes)
                </span>
                <p className="font-serif text-3xl text-gold">{formatBRL(report.totalDailyGoal)}/dia</p>
              </div>
            </div>
            <p className="mt-1 text-xs text-muted">
              13º + férias + imprevistos + impostos do mês, somados. Baseado na folha salarial de{" "}
              {formatBRL(report.monthlySalaries)}/mês marcada como elegível em Custos Fixos.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ProvisionCard
              title="13º salário"
              provision={report.thirteenth}
              helpText={`1 mês de folha por ano, 1/12 acumulado a cada mês (já passaram ${report.period.monthsElapsed} de 12 meses em ${report.period.year}).`}
            />
            <ProvisionCard
              title="Férias"
              provision={report.vacation}
              helpText="1 mês de folha + 1/3 constitucional por ano, mesma lógica de acúmulo mensal do 13º."
            />
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-serif text-lg text-foreground">Imprevistos</h2>
                <p className="text-xs text-muted">
                  Meta: cobrir {report.contingency.monthsOfCoverage} mês(es) do custo fixo total
                  atual ({formatBRL(report.totalMonthlyFixedCosts)}/mês).
                </p>
              </div>
              <div className="no-print flex gap-1 rounded-lg border border-border bg-background p-1">
                {[1, 3, 6].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setContingencyMonths(m)}
                    className={
                      m === contingencyMonths
                        ? "rounded bg-gold px-2.5 py-1 text-xs font-medium text-black"
                        : "rounded px-2.5 py-1 text-xs font-medium text-muted transition hover:text-foreground"
                    }
                  >
                    {m} {m === 1 ? "mês" : "meses"}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="block text-xs font-medium tracking-wide text-muted uppercase">
                  Guardado até agora
                </span>
                <span className="font-serif text-2xl text-gold">
                  {formatBRL(report.contingency.saved)}
                </span>
              </div>
              <div>
                <span className="block text-xs font-medium tracking-wide text-muted uppercase">
                  Meta total
                </span>
                <span className="font-serif text-2xl text-foreground">
                  {formatBRL(report.contingency.target)}
                </span>
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-muted">
                <span>
                  Sugestão pra guardar por mês: {formatBRL(report.contingency.suggestedMonthlySaving)}
                </span>
                <span>
                  {report.contingency.target > 0
                    ? Math.min(100, (report.contingency.saved / report.contingency.target) * 100).toFixed(0)
                    : 0}
                  %
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full bg-gold"
                  style={{
                    width: `${report.contingency.target > 0 ? Math.min(100, (report.contingency.saved / report.contingency.target) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
            <p className="text-xs text-muted">
              Meta diária pra fechar o mês em dia:{" "}
              <span className="font-medium text-foreground">
                {formatBRL(report.contingency.dailyGoal)}/dia
              </span>
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-serif text-lg text-foreground">Impostos</h2>
                <p className="text-xs text-muted">
                  {report.tax.ratePercent}% sobre o faturamento de{" "}
                  {MONTHS[report.period.month - 1]}/{report.period.year} (
                  {formatBRL(report.tax.monthlyRevenue)} até agora) — reseta todo mês, não acumula
                  como 13º/férias.
                </p>
              </div>
              <div className="no-print flex items-end gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted">Alíquota (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    value={taxRateInput}
                    onChange={(e) => setTaxRateInput(e.target.value)}
                    onBlur={applyTaxRate}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyTaxRate();
                      }
                    }}
                    className="w-20 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    className="text-xs font-medium text-muted"
                    title="Dia do mês em que o DAS costuma vencer (padrão do Simples Nacional: dia 20 do mês seguinte)."
                  >
                    Dia do vencimento
                  </label>
                  <input
                    type="number"
                    step="1"
                    min={1}
                    max={31}
                    value={taxDueDayInput}
                    onChange={(e) => setTaxDueDayInput(e.target.value)}
                    onBlur={applyTaxDueDay}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyTaxDueDay();
                      }
                    }}
                    className="w-16 rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-gold focus:outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <span className="block text-xs font-medium tracking-wide text-muted uppercase">
                  Guardado esse mês
                </span>
                <span className="font-serif text-2xl text-gold">{formatBRL(report.tax.saved)}</span>
              </div>
              <div>
                <span className="block text-xs font-medium tracking-wide text-muted uppercase">
                  Imposto estimado do mês
                </span>
                <span className="font-serif text-2xl text-foreground">
                  {formatBRL(report.tax.target)}
                </span>
              </div>
              <div>
                <span className="block text-xs font-medium tracking-wide text-muted uppercase">
                  Vencimento
                </span>
                <span
                  className={`font-serif text-2xl ${
                    report.tax.daysUntilDue < 0
                      ? "text-red-400"
                      : report.tax.daysUntilDue <= 3
                        ? "text-red-400"
                        : report.tax.daysUntilDue <= 10
                          ? "text-amber-400"
                          : "text-foreground"
                  }`}
                >
                  {formatDate(report.tax.dueDate)}
                </span>
                <span className="block text-xs text-muted">
                  {report.tax.daysUntilDue < 0
                    ? `Venceu há ${Math.abs(report.tax.daysUntilDue)} dia(s)`
                    : report.tax.daysUntilDue === 0
                      ? "Vence hoje"
                      : `Faltam ${report.tax.daysUntilDue} dia(s)`}
                </span>
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-muted">
                <span>Deixe separado até o vencimento do DAS</span>
                <span>
                  {report.tax.target > 0
                    ? Math.min(100, (report.tax.saved / report.tax.target) * 100).toFixed(0)
                    : 0}
                  %
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full bg-gold"
                  style={{
                    width: `${report.tax.target > 0 ? Math.min(100, (report.tax.saved / report.tax.target) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
            <p className="text-xs text-muted">
              Meta diária pra fechar o mês em dia:{" "}
              <span className="font-medium text-foreground">{formatBRL(report.tax.dailyGoal)}/dia</span>
            </p>
          </div>

          {deposits.length > 0 && (
            <div className="no-print flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
              <h2 className="font-serif text-lg text-foreground">Valores guardados registrados</h2>
              <ul className="flex flex-col gap-1 text-sm">
                {deposits.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between border-b border-border/50 py-1.5"
                  >
                    <div>
                      <span className="mr-2 rounded bg-gold/20 px-2 py-0.5 text-xs font-medium text-gold">
                        {CATEGORY_LABEL[d.category]}
                      </span>
                      <span className="text-foreground">{formatBRL(d.amount)}</span>
                      <span className="ml-2 text-xs text-muted">{formatDate(d.date)}</span>
                      {d.notes && <span className="ml-2 text-xs text-muted">— {d.notes}</span>}
                    </div>
                    <button
                      onClick={() => handleDeleteDeposit(d.id)}
                      className="text-xs font-medium text-red-400 hover:underline"
                    >
                      Excluir
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.eligibleFixedCosts.length > 0 && (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
              <h2 className="font-serif text-lg text-foreground">
                Folha considerada no cálculo ({MONTHS[report.period.month - 1]}/{report.period.year})
              </h2>
              <p className="text-xs text-muted">
                Marcado como &quot;13º/Férias&quot; em{" "}
                <a href="/custos-fixos" className="text-gold hover:underline">
                  Custos Fixos
                </a>
                . Ajuste lá se algo estiver errado.
              </p>
              <ul className="mt-1 flex flex-col gap-1 text-sm">
                {report.eligibleFixedCosts.map((fc) => (
                  <li key={fc.id} className="flex justify-between border-b border-border/50 py-1">
                    <span className="text-foreground">{fc.description}</span>
                    <span className="text-muted">{formatBRL(fc.monthlyAmount)}</span>
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
