/**
 * Regras sobre as notas fiscais importadas: de que lado a empresa está em cada
 * nota, quais CFOPs contam como venda ou devolução, e os resumos que a tela de
 * Notas Fiscais mostra. Tudo puro — o repositório entrega as linhas prontas.
 */

/** CNPJ da Holm (razão social Regimar Souza Silva Ltda). */
export const COMPANY_DOCUMENTS = ["49046940000100"];

export type FiscalNoteDirection = "SAIDA" | "ENTRADA_PROPRIA" | "ENTRADA_TERCEIRO";

/**
 * SAIDA: a empresa emitiu uma nota de saída (venda, remessa...).
 * ENTRADA_PROPRIA: a empresa emitiu uma nota de entrada — é assim que sai a
 * devolução de venda para pessoa física (o Mercado Livre emite em nome dela).
 * ENTRADA_TERCEIRO: outra empresa emitiu para a Holm (compra, facção, devolução
 * de cliente com CNPJ). Nota em que a Holm não aparece volta null.
 */
export function classifyDirection(
  note: { issuerDocument: string; recipientDocument: string | null; operationType: number },
  companyDocuments: readonly string[] = COMPANY_DOCUMENTS,
): FiscalNoteDirection | null {
  if (companyDocuments.includes(note.issuerDocument)) {
    return note.operationType === 0 ? "ENTRADA_PROPRIA" : "SAIDA";
  }
  if (note.recipientDocument && companyDocuments.includes(note.recipientDocument)) {
    return "ENTRADA_TERCEIRO";
  }
  return null;
}

/** Venda de mercadoria (x101–x125, x401–x405), do ponto de vista de quem emite. */
export function isSaleCfop(cfop: string): boolean {
  return /^[567](1(0[1-9]|1\d|2[0-5])|40[1-5])$/.test(cfop);
}

/** Devolução de venda, na nota de entrada que a própria empresa emite. */
export function isSaleReturnCfop(cfop: string): boolean {
  return /^[123](20[1-4]|41[01])$/.test(cfop);
}

/** Devolução de compra, na nota que o cliente com CNPJ emite para a empresa. */
export function isCustomerReturnCfop(cfop: string): boolean {
  return /^[567](20[1-2]|41[01])$/.test(cfop);
}

/** Venda de produção própria (x101, x103, x105, x107, x109, x111, x116, x118, x122, x401). */
export function isOwnProductionSaleCfop(cfop: string): boolean {
  return /^[567](10[13579]|111|116|118|122|401)$/.test(cfop);
}

const INTERMEDIARIES: Record<string, string> = {
  "03007331000141": "Mercado Livre",
  "35635824000112": "Shopee",
};

export function channelName(intermediaryDocument: string | null): string {
  if (!intermediaryDocument) return "Venda direta";
  return INTERMEDIARIES[intermediaryDocument] ?? `Intermediador ${intermediaryDocument}`;
}

/** Linha por item de nota, com os campos da nota que os resumos precisam. */
export type FiscalItemRow = {
  noteId: string;
  issueMonth: string;
  direction: FiscalNoteDirection;
  purpose: number;
  cancelled: boolean;
  recipientUf: string | null;
  intermediaryDocument: string | null;
  issuerDocument: string;
  issuerName: string;
  issuerCrt: number | null;
  cfop: string;
  netValue: number;
  icmsCode: string | null;
  icmsValue: number;
  simplesCreditValue: number;
};

type RowKind = "sale" | "return" | "purchase" | "otherOut" | "otherIn";

export function rowKind(row: FiscalItemRow): RowKind {
  if (row.direction === "SAIDA") return isSaleCfop(row.cfop) ? "sale" : "otherOut";
  if (row.direction === "ENTRADA_PROPRIA") return isSaleReturnCfop(row.cfop) ? "return" : "otherIn";
  if (row.purpose === 4 && isCustomerReturnCfop(row.cfop)) return "return";
  return isSaleCfop(row.cfop) ? "purchase" : "otherIn";
}

export type MonthSummary = {
  month: string;
  saleNotes: number;
  grossSales: number;
  returns: number;
  /** Vendas − devoluções: a receita bruta que o Simples considera. */
  netSales: number;
  spSales: number;
  /** Fração (0–1) das vendas que foram para SP. */
  spShare: number;
  cancelledNotes: number;
  purchaseNotes: number;
  purchases: number;
  /** ICMS destacado nas compras de fornecedores do regime normal. */
  purchaseIcms: number;
  /** Crédito de ICMS informado por fornecedores do Simples. */
  purchaseSimplesCredit: number;
  otherOutflows: number;
};

function emptyMonth(month: string): MonthSummary {
  return {
    month, saleNotes: 0, grossSales: 0, returns: 0, netSales: 0, spSales: 0, spShare: 0,
    cancelledNotes: 0, purchaseNotes: 0, purchases: 0, purchaseIcms: 0, purchaseSimplesCredit: 0,
    otherOutflows: 0,
  };
}

export function summarizeMonths(rows: FiscalItemRow[]): MonthSummary[] {
  const months = new Map<string, MonthSummary>();
  const saleNotes = new Map<string, Set<string>>();
  const purchaseNotes = new Map<string, Set<string>>();
  const cancelled = new Map<string, Set<string>>();
  const get = <T>(map: Map<string, Set<T>>, key: string) => map.get(key) ?? map.set(key, new Set()).get(key)!;

  for (const row of rows) {
    const m = months.get(row.issueMonth) ?? months.set(row.issueMonth, emptyMonth(row.issueMonth)).get(row.issueMonth)!;
    if (row.cancelled) {
      if (row.direction === "SAIDA") get(cancelled, row.issueMonth).add(row.noteId);
      continue;
    }
    switch (rowKind(row)) {
      case "sale":
        m.grossSales += row.netValue;
        if (row.recipientUf === "SP") m.spSales += row.netValue;
        get(saleNotes, row.issueMonth).add(row.noteId);
        break;
      case "return":
        m.returns += row.netValue;
        break;
      case "purchase":
        m.purchases += row.netValue;
        m.purchaseIcms += row.icmsValue;
        m.purchaseSimplesCredit += row.simplesCreditValue;
        get(purchaseNotes, row.issueMonth).add(row.noteId);
        break;
      case "otherOut":
        m.otherOutflows += row.netValue;
        break;
    }
  }

  return [...months.values()]
    .map((m) => ({
      ...m,
      saleNotes: saleNotes.get(m.month)?.size ?? 0,
      purchaseNotes: purchaseNotes.get(m.month)?.size ?? 0,
      cancelledNotes: cancelled.get(m.month)?.size ?? 0,
      netSales: m.grossSales - m.returns,
      spShare: m.grossSales > 0 ? m.spSales / m.grossSales : 0,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/** "2026-09" menos `count` meses. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Receita bruta dos 12 meses que terminam em `endMonth` (inclusive), só com
 * o que foi importado — `monthsWithData` diz quantos desses meses têm nota.
 */
export function computeRbt12(summaries: MonthSummary[], endMonth: string) {
  const start = shiftMonth(endMonth, -11);
  const inWindow = summaries.filter((s) => s.month >= start && s.month <= endMonth);
  return {
    startMonth: start,
    endMonth,
    value: inWindow.reduce((sum, s) => sum + s.netSales, 0),
    monthsWithData: inWindow.filter((s) => s.saleNotes > 0).length,
  };
}

type Group = { key: string; label: string; notes: number; value: number; share: number };

function grouped(
  rows: FiscalItemRow[],
  keyOf: (r: FiscalItemRow) => string,
  labelOf: (r: FiscalItemRow) => string = keyOf,
): Group[] {
  const acc = new Map<string, { label: string; notes: Set<string>; value: number }>();
  let total = 0;
  for (const r of rows) {
    const key = keyOf(r);
    const e = acc.get(key) ?? acc.set(key, { label: labelOf(r), notes: new Set(), value: 0 }).get(key)!;
    e.notes.add(r.noteId);
    e.value += r.netValue;
    total += r.netValue;
  }
  return [...acc.entries()]
    .map(([key, e]) => ({ key, label: e.label, notes: e.notes.size, value: e.value, share: total > 0 ? e.value / total : 0 }))
    .sort((a, b) => b.value - a.value);
}

export type SupplierSummary = {
  document: string;
  name: string;
  /** 1/2/4: Simples (ou MEI); 3: regime normal. */
  crt: number | null;
  notes: number;
  value: number;
  icms: number;
  simplesCredit: number;
};

export type MonthDetail = {
  month: string;
  byUf: Group[];
  byChannel: Group[];
  /** Venda de produção própria × revenda de mercadoria de terceiros, pelo CFOP. */
  byOrigin: Group[];
  /** Como cada cadastro emissor aparece nas notas (o mesmo CNPJ pode ter dois nomes). */
  byIssuerName: (Group & { icmsCodes: string[] })[];
  byCfopOtherOut: Group[];
  suppliers: SupplierSummary[];
  /** Vendas do Simples com CSOSN 400 ("não tributada pelo Simples"). */
  csosn400: { notes: number; value: number };
};

export function detailForMonth(rows: FiscalItemRow[], month: string): MonthDetail {
  const live = rows.filter((r) => r.issueMonth === month && !r.cancelled);
  const sales = live.filter((r) => rowKind(r) === "sale");
  const purchases = live.filter((r) => rowKind(r) === "purchase");

  const codesByIssuer = new Map<string, Set<string>>();
  for (const r of sales) {
    const set = codesByIssuer.get(r.issuerName) ?? codesByIssuer.set(r.issuerName, new Set()).get(r.issuerName)!;
    if (r.icmsCode) set.add(r.icmsCode);
  }

  const supplierMap = new Map<string, SupplierSummary & { noteIds: Set<string> }>();
  for (const r of purchases) {
    const s = supplierMap.get(r.issuerDocument) ?? supplierMap
      .set(r.issuerDocument, { document: r.issuerDocument, name: r.issuerName, crt: r.issuerCrt, notes: 0, value: 0, icms: 0, simplesCredit: 0, noteIds: new Set() })
      .get(r.issuerDocument)!;
    s.noteIds.add(r.noteId);
    s.value += r.netValue;
    s.icms += r.icmsValue;
    s.simplesCredit += r.simplesCreditValue;
  }

  const csosn400 = sales.filter((r) => r.icmsCode === "400");

  return {
    month,
    byUf: grouped(sales, (r) => r.recipientUf ?? "?"),
    byChannel: grouped(sales, (r) => channelName(r.intermediaryDocument)),
    byOrigin: grouped(sales, (r) => (isOwnProductionSaleCfop(r.cfop) ? "Produção própria" : "Revenda de terceiros")),
    byIssuerName: grouped(sales, (r) => r.issuerName).map((g) => ({
      ...g,
      icmsCodes: [...(codesByIssuer.get(g.key) ?? [])].sort(),
    })),
    byCfopOtherOut: grouped(live.filter((r) => rowKind(r) === "otherOut"), (r) => r.cfop),
    suppliers: [...supplierMap.values()]
      .map(({ noteIds, ...s }) => ({ ...s, notes: noteIds.size }))
      .sort((a, b) => b.value - a.value),
    csosn400: {
      notes: new Set(csosn400.map((r) => r.noteId)).size,
      value: csosn400.reduce((sum, r) => sum + r.netValue, 0),
    },
  };
}
