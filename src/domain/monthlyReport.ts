/**
 * Ticket médio = receita bruta do período / número de vendas do período.
 */
export function computeAverageTicket(grossRevenue: number, salesCount: number): number | null {
  return salesCount > 0 ? grossRevenue / salesCount : null;
}
