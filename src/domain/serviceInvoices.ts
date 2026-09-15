/**
 * NFS-e do padrão nacional em que a Holm (CNPJ Regimar Souza Silva Ltda, ver
 * COMPANY_DOCUMENTS em fiscalNotes.ts) é a tomadora — mão de obra de
 * produção (corte, costura, facção) contratada de terceiro e paga direto
 * pela conta do Mercado Pago, sem nunca virar lançamento no Holm Finance.
 * Cada nota importada aqui vira um Entry pago de verdade, ao contrário da
 * MlServiceInvoice (custo do grupo Mercado Livre já descontado do repasse).
 */

/** Ordem importa: a primeira palavra-chave que bater decide a categoria. */
const CATEGORY_KEYWORDS: readonly (readonly [RegExp, string])[] = [
  [/cort|enfest/i, "Corte diretamente ligado à produção"],
  [/costur|alfaiat|fac[çc][ãa]o/i, "Costura"],
  [/bordad/i, "Bordado"],
  [/casead/i, "Caseado"],
  [/estamp/i, "Estamparia"],
  [/passad|engomad/i, "Passadoria"],
  [/aviament/i, "Aviamentos"],
  [/tecido/i, "Tecido"],
];

/** Nome da categoria de custo pra sugerir, ou null quando nada bate (fica sem categoria pra revisão manual). */
export function guessServiceCategoryName(serviceDescription: string, taxDescription: string): string | null {
  const text = `${serviceDescription} ${taxDescription}`;
  for (const [pattern, name] of CATEGORY_KEYWORDS) {
    if (pattern.test(text)) return name;
  }
  return null;
}

/**
 * Chave que impede duplicar a mesma nota. A chave de acesso da NFS-e (44
 * dígitos) já identifica a nota sozinha; sem ela (PDF antigo, sem QR code
 * legível), cai em prestador + número + data + valor.
 */
export function serviceInvoiceDedupeKey(note: {
  accessKey: string;
  providerDocument: string;
  documentNumber: string;
  issuedOn: Date;
  amount: number;
}): string {
  if (note.accessKey) return note.accessKey;
  return [
    note.providerDocument,
    note.documentNumber,
    note.issuedOn.toISOString().slice(0, 10),
    note.amount.toFixed(2),
  ].join("|");
}
