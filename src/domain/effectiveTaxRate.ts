/**
 * Alíquota efetiva do DAS: o que foi apurado dividido pela receita do mês, no extrato mais
 * recente do PGDAS-D. É o imposto real sobre o preço de venda (já inclui ICMS, IPI, PIS,
 * COFINS, IRPJ, CSLL e CPP). Sobe com o RBT12 dentro da faixa 6.
 */
export type EffectiveTaxRate = { period: string; rate: number };

export function latestEffectiveRate(
  apuracoes: { period: string; revenue: number; taxes: { total: number } }[],
): EffectiveTaxRate | null {
  const valid = apuracoes.filter((a) => a.revenue > 0 && a.taxes.total > 0).sort((a, b) => a.period.localeCompare(b.period));
  const last = valid.at(-1);
  return last ? { period: last.period, rate: last.taxes.total / last.revenue } : null;
}
