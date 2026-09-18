import type { DreGroup } from "@/domain/dre";

/**
 * Confere os custos fixos cadastrados contra o que foi lançado no mês, por
 * categoria. Lançamentos importados do banco não ficam ligados ao custo fixo,
 * então a comparação é pela categoria: soma do que o cadastro prevê para o mês
 * × soma do que foi lançado naquela categoria.
 */

/** Grupos em que a conferência faz sentido; custo das peças e juros têm cálculo próprio na DRE. */
export const FIXED_COST_GROUPS: DreGroup[] = [
  "DESPESA_PESSOAL",
  "DESPESA_ADMINISTRATIVA",
  "DESPESA_COMERCIAL",
  "DESPESA_PRODUTIVA",
];

/** Lançado abaixo desta fração do previsto: provavelmente faltou lançar. */
export const BELOW_SHARE = 0.5;
/** Lançado acima deste múltiplo do previsto: pode ter pagamento de outro mês junto. */
export const ABOVE_MULTIPLE = 1.6;
/** Diferenças menores que isso não viram alerta. */
export const MIN_GAP = 100;

export type FixedCostExpectation = {
  description: string;
  category: string | null;
  group: DreGroup | null;
  amount: number;
  /** Quantas vezes o custo cai no mês (semanal = 4 ou 5, quinzenal = 2...). */
  occurrences: number;
};

export type FixedCostGapKind = "faltando" | "abaixo" | "acima" | "sem-categoria";

export type FixedCostGap = {
  kind: FixedCostGapKind;
  category: string;
  expected: number;
  launched: number;
  items: string[];
};

export function findFixedCostGaps(
  expectations: FixedCostExpectation[],
  launchedByCategory: Record<string, number>,
): FixedCostGap[] {
  const gaps: FixedCostGap[] = [];
  const byCategory = new Map<string, { expected: number; items: string[] }>();

  for (const e of expectations) {
    const expected = e.amount * e.occurrences;
    if (expected <= 0) continue;
    if (!e.category) {
      gaps.push({ kind: "sem-categoria", category: "(sem categoria)", expected, launched: 0, items: [e.description] });
      continue;
    }
    if (!e.group || !FIXED_COST_GROUPS.includes(e.group)) continue;
    const current = byCategory.get(e.category) ?? { expected: 0, items: [] };
    current.expected += expected;
    current.items.push(e.description);
    byCategory.set(e.category, current);
  }

  for (const [category, { expected, items }] of byCategory) {
    const launched = launchedByCategory[category] ?? 0;
    const gap = Math.abs(expected - launched);
    if (gap < MIN_GAP) continue;
    let kind: FixedCostGapKind | null = null;
    if (launched < 0.005) kind = "faltando";
    else if (launched <= expected * BELOW_SHARE) kind = "abaixo";
    else if (launched > expected * ABOVE_MULTIPLE) kind = "acima";
    if (kind) gaps.push({ kind, category, expected, launched, items });
  }

  return gaps.sort((a, b) => Math.abs(b.expected - b.launched) - Math.abs(a.expected - a.launched));
}
