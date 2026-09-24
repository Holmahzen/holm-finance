import type { CashFlowMovement } from "@/domain/cashFlow";
import type { CogsResult } from "@/domain/cogs";

export type PlannedPurchaseKind = "MATERIAL" | "COSTURA";

export type PlannedPurchaseLike = {
  kind: string;
  label: string;
  amount: number;
  dueDate: Date;
  installments: number;
};

/** Soma `months` meses em UTC, sem estourar o fim do mês (31/01 + 1 mês = 28/02). */
export function addMonthsUTC(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(date.getUTCDate(), lastDay)));
}

export function addDaysUTC(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Divide em parcelas de centavos exatos; a diferença de arredondamento vai pra última. */
export function splitInstallments(total: number, installments: number): number[] {
  const n = Math.max(1, Math.floor(installments));
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / n);
  const parts = Array.from({ length: n }, () => base);
  parts[n - 1] += cents - base * n;
  return parts.map((c) => c / 100);
}

/**
 * Saídas simuladas de compras planejadas, pra sobrepor na projeção. Nunca
 * entram no "pode gastar" nem em nada real — só na curva "com compras".
 * Data no passado cai em hoje (mesma regra dos lançamentos vencidos).
 */
export function plannedPurchaseMovements(
  purchases: PlannedPurchaseLike[],
  today: Date,
  windowEnd: Date,
): CashFlowMovement[] {
  const movements: CashFlowMovement[] = [];

  for (const p of purchases) {
    const parts = p.kind === "COSTURA" ? [p.amount] : splitInstallments(p.amount, p.installments);

    parts.forEach((value, i) => {
      const raw = addMonthsUTC(p.dueDate, i);
      const date = raw < today ? today : raw;
      if (date >= windowEnd) return;
      const suffix = parts.length > 1 ? ` ${i + 1}/${parts.length}` : "";
      movements.push({
        date,
        amount: -value,
        label: `${p.label} — planejado${suffix}`,
        planned: true,
      });
    });
  }

  return movements;
}

export type PurchaseSuggestion = {
  /** Custo de tecido das peças vendidas nos últimos 30 dias — o que "gastou" de tecido. */
  tecido: number;
  aviamentos: number;
  /** Quanto de costura cada R$ 1 de tecido gera, pelas peças vendidas. null sem tecido. */
  costuraPerTecido: number | null;
  coveragePercent: number | null;
  lowCoverage: boolean;
};

/**
 * Reposição de 30 dias: repor o que as peças vendidas consumiram, usando o
 * custo cadastrado em Produtos. Devolve valor em R$ — o sistema não controla
 * estoque nem metros, então não dá pra sugerir quantidade de tecido.
 */
export function suggestPurchase(cogs: CogsResult, minCoveragePercent: number): PurchaseSuggestion | null {
  if (cogs.tecido + cogs.aviamentos <= 0) return null;
  return {
    tecido: cogs.tecido,
    aviamentos: cogs.aviamentos,
    costuraPerTecido: cogs.tecido > 0 ? cogs.costura / cogs.tecido : null,
    coveragePercent: cogs.coveragePercent,
    lowCoverage: cogs.coveragePercent !== null && cogs.coveragePercent < minCoveragePercent,
  };
}
