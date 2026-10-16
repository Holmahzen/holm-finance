export type MatchableEntry = {
  id: string;
  type: "PAYABLE" | "RECEIVABLE";
  amount: string;
  dueDate: Date;
  counterpartyName?: string | null;
  counterpartyDocument?: string | null;
  /**
   * Pagamento que costuma sair com valor diferente do lançamento (costureira:
   * peças entregues até o dia do Pix). Só é sugerido com o CPF/CNPJ do Pix igual
   * ao da contraparte; a diferença aparece nos motivos.
   */
  flexibleAmount?: boolean;
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
