export const SIMPLES_NACIONAL_CEILING = 4_800_000;
/**
 * Sublimite: passou dele no ano, o ICMS/ISS sai do DAS e vai pra guia própria
 * (não tira do Simples, mas muda — e costuma aumentar — o imposto).
 */
export const SIMPLES_NACIONAL_SUBLIMIT = 3_600_000;

const ALERT_THRESHOLD_ATENCAO_PERCENT = 80;
const ALERT_THRESHOLD_CRITICO_PERCENT = 95;

export type MonthlyRevenue = { year: number; month: number; revenue: number };

export type RevenueSource = "pgdas" | "notas" | "dre";

export type SourcedMonthlyRevenue = MonthlyRevenue & { source: RevenueSource };

/**
 * Receita de cada mês, da fonte mais confiável que houver:
 * 1. PGDAS-D: o faturamento declarado no extrato do Simples — o número oficial;
 * 2. notas fiscais, quando o mês tem nota de venda importada (vendas −
 *    devoluções pela data de emissão, a mesma base que o Simples usa);
 * 3. DRE, que só registra o dinheiro que entrou no banco — nas vendas do
 *    marketplace é o repasse, já sem as tarifas, então fica bem abaixo do
 *    faturamento real. Mês só com devoluções importadas também cai aqui: sem
 *    as vendas, o valor das notas sairia negativo.
 * As chaves dos mapas são "YYYY-MM".
 */
export function pickMonthlyRevenues(
  months: { year: number; month: number }[],
  fromNotes: Record<string, { netSales: number; saleNotes: number }>,
  fromDre: Record<string, number>,
  fromPgdas: Record<string, number> = {},
): SourcedMonthlyRevenue[] {
  return months.map(({ year, month }) => {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (key in fromPgdas) return { year, month, revenue: fromPgdas[key], source: "pgdas" };
    const notes = fromNotes[key];
    if (notes && notes.saleNotes > 0) return { year, month, revenue: notes.netSales, source: "notas" };
    return { year, month, revenue: fromDre[key] ?? 0, source: "dre" };
  });
}

export type AlertLevel = "ok" | "atencao" | "critico";

/**
 * Marcos da receita do ANO-CALENDÁRIO (jan–dez) — é ela, e não o RBT12, que
 * decide o desenquadramento (LC 123/2006, art. 3º §§ 9º e 9º-A; art. 20 §§ 1º
 * e 1º-A). O RBT12 só define a faixa/alíquota do DAS.
 */
export type MilestoneKey = "sublimite" | "sublimite20" | "teto" | "teto20";

export type Milestone = {
  key: MilestoneKey;
  value: number;
  /** Mês (1–12) do ano corrente em que o acumulado passa do marco; null se não passa nem na projeção. */
  month: number | null;
  /** true quando o mês vem da projeção (ainda não aconteceu). */
  projected: boolean;
};

export type SimplesNacionalStatus = {
  rbt12: number;
  rbt12PercentOfCeiling: number;
  rbt12RemainingToCeiling: number;
  yearToDate: number;
  yearToDatePercentOfCeiling: number;
  /** Null quando não há nenhum mês fechado ainda pra estimar o ritmo. */
  projectedYearEnd: number | null;
  projectedYearEndPercentOfCeiling: number | null;
  /** Ritmo mensal usado na projeção (média dos últimos 3 meses fechados). */
  monthlyPace: number | null;
  milestones: Milestone[];
  /** Pelo acumulado do ano e pela projeção de dezembro — é o que tira do Simples. */
  alertLevel: AlertLevel;
};

function alertLevelFromPercent(percent: number): AlertLevel {
  if (percent >= ALERT_THRESHOLD_CRITICO_PERCENT) return "critico";
  if (percent >= ALERT_THRESHOLD_ATENCAO_PERCENT) return "atencao";
  return "ok";
}

/**
 * Últimos `count` meses terminando em (year, month), inclusive — ex.: (2026, 9, 12)
 * devolve de outubro/2025 a setembro/2026.
 */
export function computeTrailingMonths(
  year: number,
  month: number,
  count: number,
): { year: number; month: number }[] {
  const result: { year: number; month: number }[] = [];
  let y = year;
  let m = month;
  for (let i = 0; i < count; i++) {
    result.unshift({ year: y, month: m });
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return result;
}

/**
 * `monthlyRevenues` deve trazer os últimos 12 meses (inclusive o mês corrente,
 * mesmo que parcial) — normalmente o resultado de `computeTrailingMonths(..., 12)`
 * com a receita bruta de cada um.
 */
export function computeSimplesNacionalStatus(
  monthlyRevenues: MonthlyRevenue[],
  currentYear: number,
  currentMonth: number,
  ceiling = SIMPLES_NACIONAL_CEILING,
  sublimit = SIMPLES_NACIONAL_SUBLIMIT,
): SimplesNacionalStatus {
  const rbt12 = monthlyRevenues.reduce((sum, m) => sum + m.revenue, 0);
  const thisYear = monthlyRevenues
    .filter((m) => m.year === currentYear && m.month <= currentMonth)
    .sort((a, b) => a.month - b.month);
  const yearToDate = thisYear.reduce((sum, m) => sum + m.revenue, 0);
  const currentPartial = thisYear.find((m) => m.month === currentMonth)?.revenue ?? 0;

  // Ritmo: média dos últimos 3 meses FECHADOS (sem o mês corrente, ainda em
  // andamento). O mês corrente entra na projeção pelo maior entre o que já foi
  // faturado nele e esse ritmo — senão, no começo do mês, a projeção perderia
  // quase um mês inteiro de faturamento.
  const closedMonths = monthlyRevenues.filter(
    (m) => !(m.year === currentYear && m.month === currentMonth),
  );
  const last3Closed = closedMonths.slice(-3);
  const monthlyPace =
    last3Closed.length > 0 ? last3Closed.reduce((sum, m) => sum + m.revenue, 0) / last3Closed.length : null;

  const projectedByMonth = new Map<number, number>();
  for (const m of thisYear) {
    if (m.month < currentMonth) projectedByMonth.set(m.month, m.revenue);
  }
  if (monthlyPace !== null) {
    projectedByMonth.set(currentMonth, Math.max(currentPartial, monthlyPace));
    for (let m = currentMonth + 1; m <= 12; m++) projectedByMonth.set(m, monthlyPace);
  }
  const projectedYearEnd =
    monthlyPace === null ? null : [...projectedByMonth.values()].reduce((sum, v) => sum + v, 0);

  const milestoneValues: [MilestoneKey, number][] = [
    ["sublimite", sublimit],
    ["sublimite20", sublimit * 1.2],
    ["teto", ceiling],
    ["teto20", ceiling * 1.2],
  ];
  const milestones = milestoneValues.map(([key, value]): Milestone => {
    let cumulative = 0;
    for (const m of thisYear) {
      cumulative += m.revenue;
      if (cumulative > value) return { key, value, month: m.month, projected: false };
    }
    if (monthlyPace !== null) {
      cumulative = 0;
      for (let m = 1; m <= 12; m++) {
        cumulative += projectedByMonth.get(m) ?? 0;
        if (cumulative > value) return { key, value, month: m, projected: true };
      }
    }
    return { key, value, month: null, projected: false };
  });

  const yearToDatePercentOfCeiling = ceiling > 0 ? (yearToDate / ceiling) * 100 : 0;
  const projectedYearEndPercentOfCeiling =
    projectedYearEnd !== null && ceiling > 0 ? (projectedYearEnd / ceiling) * 100 : null;

  return {
    rbt12,
    rbt12PercentOfCeiling: ceiling > 0 ? (rbt12 / ceiling) * 100 : 0,
    rbt12RemainingToCeiling: ceiling - rbt12,
    yearToDate,
    yearToDatePercentOfCeiling,
    projectedYearEnd,
    projectedYearEndPercentOfCeiling,
    monthlyPace,
    milestones,
    alertLevel: alertLevelFromPercent(Math.max(yearToDatePercentOfCeiling, projectedYearEndPercentOfCeiling ?? 0)),
  };
}
