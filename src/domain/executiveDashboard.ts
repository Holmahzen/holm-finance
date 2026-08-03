export type GrossMargin = {
  value: number;
  percent: number | null;
};

/**
 * Margem bruta = Receita Líquida - CMV (só tecido/costura/aviamentos, sem
 * comissão/frete/embalagem) — diferente da margem de contribuição, que já
 * desconta todos os custos variáveis. `percent` é null sem receita líquida
 * pra não dividir por zero.
 */
export function computeGrossMargin(receitaLiquida: number, cogsTotal: number): GrossMargin {
  const value = receitaLiquida - cogsTotal;
  const percent = receitaLiquida > 0 ? value / receitaLiquida : null;
  return { value, percent };
}

/**
 * CAC = gasto com publicidade no período / clientes únicos que compraram no
 * período. `null` sem clientes (não dá pra dividir por zero) — nesse caso o
 * gasto existe mas não converteu nenhuma venda ainda.
 */
export function computeCAC(adSpend: number, uniqueCustomers: number): number | null {
  return uniqueCustomers > 0 ? adSpend / uniqueCustomers : null;
}

/**
 * Ticket médio = receita bruta do período / número de vendas do período.
 */
export function computeAverageTicket(grossRevenue: number, salesCount: number): number | null {
  return salesCount > 0 ? grossRevenue / salesCount : null;
}

/**
 * Geração de caixa do período = entradas - saídas realizadas (mesma fonte
 * do Fluxo de Caixa) — positivo significa que o caixa cresceu no período.
 */
export function computeCashGeneration(inflow: number, outflow: number): number {
  return inflow - outflow;
}
