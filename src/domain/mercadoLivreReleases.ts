const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * O Mercado Livre libera o dinheiro alguns dias depois de o comprador receber
 * o pacote — não na data da venda. O relatório de vendas não traz a data do
 * repasse (só o relatório de faturamento traz), então ela é estimada a partir
 * da data de entrega. 2 dias é o prazo padrão da plataforma.
 */
export const RELEASE_DELAY_DAYS = 2;

export type SaleForRelease = {
  status: string;
  netRevenue: number;
  deliveredAt: Date | null;
};

export type ReleaseOutcome =
  /** Entregue há tempo suficiente — o dinheiro já caiu. */
  | "released"
  /** Entregue, mas ainda dentro do prazo de liberação: cai em data conhecida. */
  | "scheduled"
  /** Ainda não entregue. Vai liberar, mas sem data — depende da entrega. */
  | "awaiting-delivery"
  /** Devolução ou mediação em aberto: pode virar reembolso ao comprador. */
  | "at-risk"
  /** Cancelada ou zerada — nunca vira dinheiro. */
  | "no-cash";

export type ReleaseDay = {
  /** Data estimada do repasse, em UTC (meia-noite). */
  date: Date;
  count: number;
  amount: number;
  cumulative: number;
  /** false enquanto a data ainda não chegou. */
  released: boolean;
};

export type ReleaseBuckets = {
  today: number;
  tomorrow: number;
  within7d: number;
  after7d: number;
};

export type ReleaseSchedule = {
  days: ReleaseDay[];
  releasedTotal: number;
  scheduledTotal: number;
  awaitingDelivery: { count: number; amount: number };
  atRisk: { count: number; amount: number };
  noCashCount: number;
  total: number;
  buckets: ReleaseBuckets;
};

/** Devolução, troca e mediação em aberto — o valor pode virar reembolso ao
 * comprador em vez de entrar no caixa. */
const AT_RISK_PATTERN = /devolu|devolvido|troca|media[cç]|reclama/i;

/** Desfechos em que o Mercado Livre já decidiu a favor do vendedor: mesmo
 * tendo passado por mediação ou devolução, o dinheiro foi liberado. Precisa
 * ser checado ANTES de `AT_RISK_PATTERN`, que também casaria com esses textos. */
const RESOLVED_IN_FAVOR_PATTERN = /te demos o dinheiro|liberamos o dinheiro/i;

const CANCELLED_PATTERN = /cancel/i;

export function startOfUTCDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

export function estimateReleaseDate(
  deliveredAt: Date,
  delayDays: number = RELEASE_DELAY_DAYS,
): Date {
  return addDays(startOfUTCDay(deliveredAt), delayDays);
}

export function classifySale(
  sale: SaleForRelease,
  today: Date,
  delayDays: number = RELEASE_DELAY_DAYS,
): { outcome: ReleaseOutcome; releaseDate: Date | null } {
  if (sale.netRevenue === 0) return { outcome: "no-cash", releaseDate: null };

  const resolvedInFavor = RESOLVED_IN_FAVOR_PATTERN.test(sale.status);

  if (!resolvedInFavor && CANCELLED_PATTERN.test(sale.status)) {
    return { outcome: "no-cash", releaseDate: null };
  }

  // Uma venda entregue tem data de repasse mesmo que depois tenha virado
  // devolução: o dinheiro chegou a cair e a devolução vira um estorno à
  // parte, que o relatório traz na própria coluna de cancelamentos.
  if (sale.deliveredAt) {
    const releaseDate = estimateReleaseDate(sale.deliveredAt, delayDays);
    // O repasse de HOJE ainda não está no saldo das contas — conta como
    // agendado, não como liberado. Fosse "liberado", o mesmo dinheiro
    // apareceria no saldo e no balde "a liberar hoje" ao mesmo tempo.
    const released = releaseDate.getTime() < startOfUTCDay(today).getTime();
    return { outcome: released ? "released" : "scheduled", releaseDate };
  }

  if (resolvedInFavor) return { outcome: "released", releaseDate: null };
  if (AT_RISK_PATTERN.test(sale.status)) return { outcome: "at-risk", releaseDate: null };

  return { outcome: "awaiting-delivery", releaseDate: null };
}

/**
 * Monta o calendário de repasses a partir das vendas importadas: quanto já
 * caiu, quanto cai em cada dia futuro, e o que ainda não tem data porque
 * depende de entrega ou do desfecho de uma devolução.
 */
export function computeReleaseSchedule(
  sales: SaleForRelease[],
  today: Date,
  delayDays: number = RELEASE_DELAY_DAYS,
): ReleaseSchedule {
  const todayUTC = startOfUTCDay(today);
  const byDay = new Map<number, { count: number; amount: number }>();

  let releasedTotal = 0;
  let scheduledTotal = 0;
  let awaitingCount = 0;
  let awaitingAmount = 0;
  let atRiskCount = 0;
  let atRiskAmount = 0;
  let noCashCount = 0;

  for (const sale of sales) {
    const { outcome, releaseDate } = classifySale(sale, todayUTC, delayDays);

    if (releaseDate) {
      const key = releaseDate.getTime();
      const bucket = byDay.get(key) ?? { count: 0, amount: 0 };
      bucket.count += 1;
      bucket.amount += sale.netRevenue;
      byDay.set(key, bucket);
    }

    switch (outcome) {
      case "released":
        releasedTotal += sale.netRevenue;
        break;
      case "scheduled":
        scheduledTotal += sale.netRevenue;
        break;
      case "awaiting-delivery":
        awaitingCount += 1;
        awaitingAmount += sale.netRevenue;
        break;
      case "at-risk":
        atRiskCount += 1;
        atRiskAmount += sale.netRevenue;
        break;
      case "no-cash":
        noCashCount += 1;
        break;
    }
  }

  let cumulative = 0;
  const days: ReleaseDay[] = [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([time, bucket]) => {
      cumulative += bucket.amount;
      return {
        date: new Date(time),
        count: bucket.count,
        amount: bucket.amount,
        cumulative,
        released: time < todayUTC.getTime(),
      };
    });

  return {
    days,
    releasedTotal,
    scheduledTotal,
    awaitingDelivery: { count: awaitingCount, amount: awaitingAmount },
    atRisk: { count: atRiskCount, amount: atRiskAmount },
    noCashCount,
    total: releasedTotal + scheduledTotal + awaitingAmount + atRiskAmount,
    buckets: computeBuckets(days, awaitingAmount, todayUTC),
  };
}

/**
 * Monta o mesmo calendário a partir de dias JÁ AGREGADOS — o formato em que o
 * Holm Marketplace Hub entrega as datas reais de repasse do Mercado Pago.
 *
 * A divisão entre liberado e agendado, o acumulado e os quatro baldes saem
 * daqui, e não do hub, de propósito: são regras deste sistema, e o "hoje" que
 * vale é o de quem está olhando a tela.
 */
export function computeScheduleFromDays(
  dias: { date: Date; count: number; amount: number }[],
  today: Date,
  extras: {
    /** Aprovado, mas o Mercado Pago ainda não fixou a data de liberação. */
    awaitingDelivery: { count: number; amount: number };
    /** Em mediação: pode virar reembolso ao comprador. */
    atRisk: { count: number; amount: number };
  },
): ReleaseSchedule {
  const todayUTC = startOfUTCDay(today);

  let cumulative = 0;
  let releasedTotal = 0;
  let scheduledTotal = 0;

  const days: ReleaseDay[] = [...dias]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((d) => {
      cumulative += d.amount;
      const released = startOfUTCDay(d.date).getTime() < todayUTC.getTime();
      if (released) releasedTotal += d.amount;
      else scheduledTotal += d.amount;
      return {
        date: startOfUTCDay(d.date),
        count: d.count,
        amount: d.amount,
        cumulative,
        released,
      };
    });

  return {
    days,
    releasedTotal,
    scheduledTotal,
    awaitingDelivery: extras.awaitingDelivery,
    atRisk: extras.atRisk,
    noCashCount: 0,
    total: releasedTotal + scheduledTotal + extras.awaitingDelivery.amount + extras.atRisk.amount,
    buckets: computeBuckets(days, extras.awaitingDelivery.amount, todayUTC),
  };
}

/**
 * Converte o calendário nos quatro campos que a projeção de fluxo de caixa e o
 * balanço consomem. Só entra dinheiro que AINDA não caiu — o que já foi
 * liberado está no saldo das contas e contaria duas vezes.
 *
 * Vendas sem data (ainda não entregues) caem em "após 7 dias": é o único
 * balde que a projeção não joga numa data específica da curva, que é
 * justamente o tratamento certo pra dinheiro sem data conhecida. Devolução e
 * mediação em aberto ficam fora dos quatro — podem virar reembolso.
 */
export function computeBuckets(
  days: ReleaseDay[],
  awaitingDeliveryAmount: number,
  today: Date,
): ReleaseBuckets {
  const todayUTC = startOfUTCDay(today);
  const buckets: ReleaseBuckets = {
    today: 0,
    tomorrow: 0,
    within7d: 0,
    after7d: awaitingDeliveryAmount,
  };

  for (const day of days) {
    const daysAhead = Math.round((day.date.getTime() - todayUTC.getTime()) / MS_PER_DAY);
    if (daysAhead < 0) continue;
    if (daysAhead === 0) buckets.today += day.amount;
    else if (daysAhead === 1) buckets.tomorrow += day.amount;
    else if (daysAhead <= 7) buckets.within7d += day.amount;
    else buckets.after7d += day.amount;
  }

  return buckets;
}
