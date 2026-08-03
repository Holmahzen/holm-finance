export type ExcelFormat = "mercado_pago" | "generic";

export type ExcelTransaction = {
  externalId: string;
  trnType: "DEBIT" | "CREDIT";
  postedAt: Date;
  amount: string;
  memo: string;
  counterpartyName?: string;
};

export type ExcelStatement = {
  format: ExcelFormat;
  transactions: ExcelTransaction[];
};
