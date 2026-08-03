export type MatchableEntry = {
  id: string;
  type: "PAYABLE" | "RECEIVABLE";
  amount: string;
  dueDate: Date;
  counterpartyName?: string | null;
  counterpartyDocument?: string | null;
};

export type MatchableTransaction = {
  id: string;
  trnType: "DEBIT" | "CREDIT";
  amount: string;
  postedAt: Date;
  parsedDocument?: string | null;
  parsedCounterpartyName?: string | null;
};

export type MatchCandidate = {
  entryId: string;
  importedTransactionId: string;
  score: number;
  reasons: string[];
};
