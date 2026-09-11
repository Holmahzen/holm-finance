/**
 * NFS-e que o grupo Mercado Livre emite contra a Holm todo mês (Ebazar e
 * filiais de envio, Mercado Pago). Quase tudo já saiu descontado de cada
 * repasse, então isto é custo do mês — nunca conta a pagar, ou o custo
 * contaria duas vezes. O demonstrativo em PDF não diz qual serviço é, então
 * a categoria sai do prestador.
 */

export type MlServiceCategory = "FRETE" | "MERCADO_PAGO" | "EBAZAR";

export const ML_SERVICE_CATEGORY_LABEL: Record<MlServiceCategory, string> = {
  FRETE: "Frete (envios)",
  MERCADO_PAGO: "Mercado Pago",
  EBAZAR: "Ebazar (tarifas etc.)",
};

/** Raiz do CNPJ do Mercado Pago Instituição de Pagamento. */
const MERCADO_PAGO_ROOT = "10573521";

export function classifyMlService(providerDocument: string, providerName: string): MlServiceCategory {
  if (providerDocument.startsWith(MERCADO_PAGO_ROOT)) return "MERCADO_PAGO";
  if (/ENVIOS/i.test(providerName)) return "FRETE";
  return "EBAZAR";
}

/**
 * Chave que impede duplicar a mesma nota. O link da prefeitura identifica a
 * nota — menos o da prefeitura de SP, que é sempre o mesmo "rps.aspx"
 * genérico; nesse caso vale prestador + data + valor + número do arquivo.
 */
export function mlServiceDedupeKey(
  statement: { link: string | null; providerDocument: string; issuedOn: Date; amount: number },
  fileName: string,
): string {
  if (statement.link && !/rps\.aspx$/i.test(statement.link)) return statement.link;
  const fileNumber = fileName.replace(/^.*[\\/]/, "").replace(/\D/g, "").replace(/^0+/, "");
  return [
    statement.providerDocument,
    statement.issuedOn.toISOString().slice(0, 10),
    statement.amount.toFixed(2),
    fileNumber,
  ].join("|");
}

export type MlServiceRow = {
  referenceMonth: string;
  providerName: string;
  providerDocument: string;
  providerCity: string;
  amount: number;
  /** "YYYY-MM-DD". */
  issuedOn: string;
  link: string | null;
};

export function mlServiceTotalsByMonth(rows: MlServiceRow[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const r of rows) totals[r.referenceMonth] = (totals[r.referenceMonth] ?? 0) + r.amount;
  return totals;
}

export type MlServiceMonthDetail = {
  month: string;
  total: number;
  count: number;
  byCategory: { key: MlServiceCategory; label: string; count: number; value: number; share: number }[];
  invoices: (MlServiceRow & { category: MlServiceCategory })[];
};

export function mlServiceDetailForMonth(rows: MlServiceRow[], month: string): MlServiceMonthDetail {
  const invoices = rows
    .filter((r) => r.referenceMonth === month)
    .map((r) => ({ ...r, category: classifyMlService(r.providerDocument, r.providerName) }))
    .sort((a, b) => b.amount - a.amount);
  const total = invoices.reduce((sum, r) => sum + r.amount, 0);

  const acc = new Map<MlServiceCategory, { count: number; value: number }>();
  for (const r of invoices) {
    const e = acc.get(r.category) ?? acc.set(r.category, { count: 0, value: 0 }).get(r.category)!;
    e.count += 1;
    e.value += r.amount;
  }

  return {
    month,
    total,
    count: invoices.length,
    byCategory: [...acc]
      .map(([key, e]) => ({ key, label: ML_SERVICE_CATEGORY_LABEL[key], ...e, share: total > 0 ? e.value / total : 0 }))
      .sort((a, b) => b.value - a.value),
    invoices,
  };
}
