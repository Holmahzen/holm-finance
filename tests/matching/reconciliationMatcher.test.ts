import { describe, it, expect } from "vitest";
import { matchEntriesToTransactions } from "@/matching/reconciliationMatcher";
import { nameSimilarity } from "@/matching/nameSimilarity";
import type { MatchableEntry, MatchableTransaction } from "@/matching/types";

function entry(overrides: Partial<MatchableEntry> = {}): MatchableEntry {
  return {
    id: "entry-1",
    type: "PAYABLE",
    amount: "133.10",
    dueDate: new Date("2026-07-14T00:00:00Z"),
    counterpartyName: "GIGA MAIS FIBRA",
    counterpartyDocument: "07714104000107",
    ...overrides,
  };
}

function transaction(overrides: Partial<MatchableTransaction> = {}): MatchableTransaction {
  return {
    id: "tx-1",
    trnType: "DEBIT",
    amount: "-133.10",
    postedAt: new Date("2026-07-14T00:00:00Z"),
    parsedDocument: "07714104000107",
    parsedCounterpartyName: "GIGA MAIS FIBRA",
    ...overrides,
  };
}

describe("matchEntriesToTransactions", () => {
  it("matches an exact amount, same-day, same-document pair with a high score", () => {
    const result = matchEntriesToTransactions([entry()], [transaction()]);

    expect(result).toHaveLength(1);
    expect(result[0].entryId).toBe("entry-1");
    expect(result[0].importedTransactionId).toBe("tx-1");
    expect(result[0].score).toBe(1);
    expect(result[0].reasons).toEqual(["exact_amount", "date_0d", "counterparty_exact"]);
  });

  it("does not match when direction disagrees (payable vs credit)", () => {
    const result = matchEntriesToTransactions(
      [entry({ type: "PAYABLE" })],
      [transaction({ trnType: "CREDIT" })],
    );
    expect(result).toHaveLength(0);
  });

  it("does not match when amounts differ beyond tolerance", () => {
    const result = matchEntriesToTransactions(
      [entry({ amount: "133.10" })],
      [transaction({ amount: "-140.00" })],
    );
    expect(result).toHaveLength(0);
  });

  it("does not suggest a match when the date is far outside the window", () => {
    const result = matchEntriesToTransactions(
      [entry({ dueDate: new Date("2026-08-30T00:00:00Z"), counterpartyDocument: null, counterpartyName: null })],
      [transaction({ parsedDocument: null, parsedCounterpartyName: null })],
    );
    expect(result).toHaveLength(0);
  });

  it("still matches on amount + date alone without a counterparty", () => {
    const result = matchEntriesToTransactions(
      [entry({ counterpartyDocument: null, counterpartyName: null })],
      [transaction({ parsedDocument: null, parsedCounterpartyName: null })],
    );
    expect(result).toHaveLength(1);
    expect(result[0].score).toBe(1);
    expect(result[0].reasons).not.toContain("counterparty_exact");
  });

  it("greedily assigns the higher-scoring pair when two entries compete for one transaction", () => {
    const closeEntry = entry({ id: "entry-close", dueDate: new Date("2026-07-14T00:00:00Z") });
    const farEntry = entry({ id: "entry-far", dueDate: new Date("2026-07-18T00:00:00Z") });

    const result = matchEntriesToTransactions([closeEntry, farEntry], [transaction()]);

    expect(result).toHaveLength(1);
    expect(result[0].entryId).toBe("entry-close");
  });

  it("recognizes similar counterparty names ignoring LTDA suffix and accents", () => {
    const similarity = nameSimilarity("Regimar Souza Silva LTDA", "REGIMAR SOUZA SILVA");
    expect(similarity).toBeGreaterThan(0.9);
  });
});
