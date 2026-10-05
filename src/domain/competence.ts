import { DomainError } from "@/domain/errors";

/**
 * Data de competência a partir de "YYYY-MM" (o mês a que a despesa/receita
 * pertence, mesmo que o dinheiro tenha saído em outro). Fica no dia 1 ao meio-dia
 * UTC: dentro do mês tanto pra quem monta o período em UTC (Vercel) quanto em
 * horário de Brasília (máquina local), sem escorregar pro mês vizinho.
 */
export function competenceDateFromMonth(month: string): Date {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!m) throw new DomainError('Competência inválida — use o formato "AAAA-MM".');
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1, 12));
}
