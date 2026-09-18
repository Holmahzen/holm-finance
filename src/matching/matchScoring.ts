import { nameSimilarity } from "./nameSimilarity";

export const DATE_WINDOW_DAYS = 7;
export const COUNTERPARTY_BONUS = 0.2;
/**
 * Usado só pra desempatar candidatos concorrentes pro mesmo lançamento
 * (nunca aparece no `score` salvo/exibido) — um CPF/CNPJ do Pix batendo
 * exato com a contraparte cadastrada é evidência muito mais forte de quem
 * foi pago do que "a data bateu por coincidência". Sem isso, um pagamento
 * de mesmo valor pra uma pessoa diferente, na mesma data, ganhava do
 * lançamento certo só porque a data dele estava alguns dias mais perto —
 * foi exatamente o que aconteceu (Leonardo x Richard Marx, 18/09/2026).
 */
export const DOCUMENT_MATCH_RANK_PRIORITY = 10;
export const NAME_SIMILARITY_THRESHOLD = 0.7;
export const AMOUNT_TOLERANCE = 0.01;

export function dateProximityScore(daysDiff: number, windowDays = DATE_WINDOW_DAYS): number {
  const abs = Math.abs(daysDiff);
  if (abs >= windowDays) return 0;
  return 1 - abs / windowDays;
}

export function daysBetween(a: Date, b: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return (a.getTime() - b.getTime()) / msPerDay;
}

export function counterpartyBonus(params: {
  entryCounterpartyName?: string | null;
  entryCounterpartyDocument?: string | null;
  transactionDocument?: string | null;
  transactionCounterpartyName?: string | null;
}): { bonus: number; matched: "document" | "name" | null } {
  const {
    entryCounterpartyName,
    entryCounterpartyDocument,
    transactionDocument,
    transactionCounterpartyName,
  } = params;

  if (
    entryCounterpartyDocument &&
    transactionDocument &&
    entryCounterpartyDocument === transactionDocument
  ) {
    return { bonus: COUNTERPARTY_BONUS, matched: "document" };
  }

  if (entryCounterpartyName && transactionCounterpartyName) {
    const similarity = nameSimilarity(entryCounterpartyName, transactionCounterpartyName);
    if (similarity >= NAME_SIMILARITY_THRESHOLD) {
      return { bonus: COUNTERPARTY_BONUS, matched: "name" };
    }
  }

  return { bonus: 0, matched: null };
}
