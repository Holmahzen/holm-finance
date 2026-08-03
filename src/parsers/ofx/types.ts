export type OfxTransaction = {
  trnType: "DEBIT" | "CREDIT";
  postedAt: Date;
  amount: string;
  fitId: string;
  memo: string;
};

export type OfxStatement = {
  bankId: string;
  acctId: string;
  acctType: string;
  currency: string;
  dtStart: Date;
  dtEnd: Date;
  transactions: OfxTransaction[];
  ledgerBalance: string;
  ledgerBalanceDate: Date;
};

export type ParsedMemo =
  | { kind: "PIX_DEBIT"; document: string; name: string }
  | { kind: "PIX_CREDIT"; document: string; name: string }
  | { kind: "CARD_PURCHASE"; name: string; city: string }
  | { kind: "OTHER" };
