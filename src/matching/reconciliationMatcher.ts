import {
  AMOUNT_TOLERANCE,
  counterpartyBonus,
  dateProximityScore,
  daysBetween,
  DOCUMENT_MATCH_RANK_PRIORITY,
  FLEXIBLE_AMOUNT_MAX_DIFF,
} from "./matchScoring";
import type { MatchableEntry, MatchableTransaction, MatchCandidate } from "./types";

const MIN_SUGGEST_THRESHOLD = 0.5;

function directionMatches(entry: MatchableEntry, transaction: MatchableTransaction): boolean {
  return (
    (entry.type === "PAYABLE" && transaction.trnType === "DEBIT") ||
    (entry.type === "RECEIVABLE" && transaction.trnType === "CREDIT")
  );
}

function amountMatches(entry: MatchableEntry, transaction: MatchableTransaction): boolean {
  return Math.abs(Number(entry.amount) - Math.abs(Number(transaction.amount))) <= AMOUNT_TOLERANCE;
}

export function rejectedPairKey(entryId: string, importedTransactionId: string): string {
  return `${entryId}:${importedTransactionId}`;
}

/**
 * Pure matching core: no DB access. Produces candidate matches above the
 * suggestion threshold, then greedily assigns the highest-scoring pairs
 * (one entry per transaction).
 *
 * `rejectedPairs` exclui pares (lançamento, transação) que a analista já
 * rejeitou explicitamente antes — sem isso, o mesmo par volta a ser sugerido
 * toda vez que a conciliação roda de novo, porque rejeitar libera os dois
 * lados (entry e transação) pra tentar casar com outra coisa, mas nada
 * impede o algoritmo de escolher exatamente o mesmo par de novo se ainda for
 * o de maior score disponível.
 */
export function matchEntriesToTransactions(
  entries: MatchableEntry[],
  transactions: MatchableTransaction[],
  rejectedPairs: ReadonlySet<string> = new Set(),
): MatchCandidate[] {
  const candidates: (MatchCandidate & { rankScore: number })[] = [];

  for (const transaction of transactions) {
    for (const entry of entries) {
      if (rejectedPairs.has(rejectedPairKey(entry.id, transaction.id))) continue;
      if (!directionMatches(entry, transaction)) continue;
      const exactAmount = amountMatches(entry, transaction);
      const amountDiff = Math.abs(Number(transaction.amount)) - Number(entry.amount);
      const flexibleOk =
        !exactAmount &&
        entry.flexibleAmount === true &&
        entry.type === "PAYABLE" &&
        Number(entry.amount) > 0 &&
        Math.abs(amountDiff) <= Number(entry.amount) * FLEXIBLE_AMOUNT_MAX_DIFF;
      if (!exactAmount && !flexibleOk) continue;

      const daysDiff = daysBetween(transaction.postedAt, entry.dueDate);
      const dateScore = dateProximityScore(daysDiff);
      const { bonus, matched } = counterpartyBonus({
        entryCounterpartyName: entry.counterpartyName,
        entryCounterpartyDocument: entry.counterpartyDocument,
        transactionDocument: transaction.parsedDocument,
        transactionCounterpartyName: transaction.parsedCounterpartyName,
      });

      const score = Math.min(1, dateScore + bonus);
      if (score < MIN_SUGGEST_THRESHOLD) continue;

      // Valor diferente só vale com o CPF/CNPJ do Pix batendo exato: sem o documento
      // não há como saber se é a mesma pessoa.
      if (flexibleOk && matched !== "document") continue;

      const reasons = exactAmount
        ? ["exact_amount", `date_${Math.round(Math.abs(daysDiff))}d`]
        : [`amount_diff_${amountDiff >= 0 ? "+" : "-"}${Math.abs(amountDiff).toFixed(2)}`, `date_${Math.round(Math.abs(daysDiff))}d`];
      if (matched === "document") reasons.push("counterparty_exact");
      if (matched === "name") reasons.push("counterparty_similar");

      // rankScore só decide a ordem de atribuição greedy (nunca é salvo) —
      // documento batendo exato pesa muito mais que proximidade de data,
      // pra não perder pro "coincidiu a data" quando duas pessoas diferentes
      // têm lançamento/pagamento do mesmo valor na mesma janela.
      // Valor diferente perde de qualquer par com valor exato + documento, mas ganha de
      // coincidência de data/valor sem documento.
      const rankScore =
        dateScore + (matched === "document" ? DOCUMENT_MATCH_RANK_PRIORITY : bonus) - (exactAmount ? 0 : 5);

      candidates.push({
        entryId: entry.id,
        importedTransactionId: transaction.id,
        score,
        reasons,
        rankScore,
      });
    }
  }

  candidates.sort((a, b) => b.rankScore - a.rankScore);

  const usedEntries = new Set<string>();
  const usedTransactions = new Set<string>();
  const assigned: MatchCandidate[] = [];

  for (const candidate of candidates) {
    if (usedEntries.has(candidate.entryId)) continue;
    if (usedTransactions.has(candidate.importedTransactionId)) continue;
    usedEntries.add(candidate.entryId);
    usedTransactions.add(candidate.importedTransactionId);
    assigned.push(candidate);
  }

  return assigned;
}
