import {
  AMOUNT_TOLERANCE,
  counterpartyBonus,
  dateProximityScore,
  daysBetween,
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

/**
 * Pure matching core: no DB access. Produces candidate matches above the
 * suggestion threshold, then greedily assigns the highest-scoring pairs
 * (one entry per transaction).
 */
export function matchEntriesToTransactions(
  entries: MatchableEntry[],
  transactions: MatchableTransaction[],
): MatchCandidate[] {
  const candidates: MatchCandidate[] = [];

  for (const transaction of transactions) {
    for (const entry of entries) {
      if (!directionMatches(entry, transaction)) continue;
      if (!amountMatches(entry, transaction)) continue;

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

      const reasons = ["exact_amount", `date_${Math.round(Math.abs(daysDiff))}d`];
      if (matched === "document") reasons.push("counterparty_exact");
      if (matched === "name") reasons.push("counterparty_similar");

      candidates.push({
        entryId: entry.id,
        importedTransactionId: transaction.id,
        score,
        reasons,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

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
