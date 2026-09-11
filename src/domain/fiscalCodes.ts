import { rowKind, type FiscalItemRow } from "@/domain/fiscalNotes";

/**
 * Significado dos códigos fiscais que aparecem nas notas da Holm — não é a
 * tabela oficial inteira; código fora da lista aparece só com o número.
 * CFOP e CST/CSOSN são sempre os de quem emitiu a nota (numa compra, os do
 * fornecedor).
 */
export const CFOP_LABELS: Record<string, string> = {
  "5101": "Venda de produção própria (dentro de SP)",
  "6101": "Venda de produção própria (outro estado)",
  "5102": "Revenda de mercadoria de terceiros (dentro de SP)",
  "6102": "Revenda de mercadoria de terceiros (outro estado)",
  "5105": "Venda de produção própria que não passa pelo estabelecimento (dentro de SP)",
  "6105": "Venda de produção própria que não passa pelo estabelecimento (outro estado)",
  "5106": "Revenda de terceiros que não passa pelo estabelecimento (dentro de SP)",
  "6106": "Revenda de terceiros que não passa pelo estabelecimento (outro estado)",
  "6107": "Venda de produção própria para não contribuinte (outro estado)",
  "6108": "Revenda de terceiros para não contribuinte (outro estado)",
  "5124": "Industrialização feita para outra empresa (facção)",
  "5125": "Industrialização para outra empresa, sem a mercadoria transitar",
  "5901": "Remessa para industrialização por encomenda",
  "5902": "Retorno de mercadoria usada na industrialização por encomenda",
  "5905": "Remessa para depósito fechado ou armazém geral",
  "6905": "Remessa para depósito fechado ou armazém geral (outro estado)",
  "5910": "Remessa em bonificação, doação ou brinde",
  "5949": "Outra saída não especificada (dentro de SP)",
  "6949": "Outra saída não especificada (outro estado)",
  "1201": "Devolução de venda de produção própria (dentro de SP)",
  "2201": "Devolução de venda de produção própria (outro estado)",
  "1202": "Devolução de revenda de terceiros (dentro de SP)",
  "2202": "Devolução de revenda de terceiros (outro estado)",
  "1411": "Devolução de venda com substituição tributária (dentro de SP)",
  "2411": "Devolução de venda com substituição tributária (outro estado)",
  "5201": "Devolução de compra para industrialização (dentro de SP)",
  "5202": "Devolução de compra para revenda (dentro de SP)",
  "6201": "Devolução de compra para industrialização (outro estado)",
  "6202": "Devolução de compra para revenda (outro estado)",
  "1949": "Outra entrada não especificada (dentro de SP)",
  "2949": "Outra entrada não especificada (outro estado)",
};

/** CSOSN: código do ICMS de quem é do Simples Nacional. */
export const CSOSN_LABELS: Record<string, string> = {
  "101": "Simples — tributada, com permissão de crédito",
  "102": "Simples — tributada, sem permissão de crédito",
  "103": "Simples — isenta pela faixa de receita",
  "201": "Simples — com crédito e com substituição tributária",
  "202": "Simples — sem crédito e com substituição tributária",
  "203": "Simples — isenta pela faixa, com substituição tributária",
  "300": "Simples — imune",
  "400": "Simples — não tributada pelo Simples Nacional",
  "500": "Simples — ICMS já cobrado por substituição tributária",
  "900": "Simples — outros",
};

/** CST do ICMS: código de quem está no regime normal (Presumido/Real). */
export const CST_ICMS_LABELS: Record<string, string> = {
  "00": "Regime normal — tributada integralmente",
  "10": "Regime normal — tributada com substituição tributária",
  "20": "Regime normal — com redução de base de cálculo",
  "30": "Regime normal — isenta ou não tributada, com ST",
  "40": "Regime normal — isenta",
  "41": "Regime normal — não tributada",
  "50": "Regime normal — suspensão",
  "51": "Regime normal — diferimento",
  "60": "Regime normal — ICMS já cobrado por substituição tributária",
  "70": "Regime normal — redução de base e ST",
  "90": "Regime normal — outras",
};

export function icmsCodeKey(code: string | null): string {
  if (!code) return "sem ICMS";
  return code.length === 3 ? `CSOSN ${code}` : `CST ${code}`;
}

export function icmsCodeLabel(code: string | null): string {
  if (!code) return "item sem grupo de ICMS";
  return (code.length === 3 ? CSOSN_LABELS[code] : CST_ICMS_LABELS[code]) ?? "—";
}

export type CodeGroup = { code: string; label: string; notes: number; value: number; share: number };

export type CodeBreakdown = { byNcm: CodeGroup[]; byCfop: CodeGroup[]; byIcmsCode: CodeGroup[] };

export type FiscalCodeKind = "sale" | "return" | "purchase";

function group(
  rows: FiscalItemRow[],
  codeOf: (r: FiscalItemRow) => string,
  labelOf: (r: FiscalItemRow) => string,
): CodeGroup[] {
  // O rótulo do NCM é o produto de maior valor do grupo — um exemplo real.
  const acc = new Map<string, { label: string; best: number; notes: Set<string>; value: number }>();
  let total = 0;
  for (const r of rows) {
    const code = codeOf(r);
    const e = acc.get(code) ?? acc.set(code, { label: "", best: -Infinity, notes: new Set(), value: 0 }).get(code)!;
    e.notes.add(r.noteId);
    e.value += r.netValue;
    total += r.netValue;
    if (r.netValue > e.best) {
      e.best = r.netValue;
      e.label = labelOf(r);
    }
  }
  return [...acc.entries()]
    .map(([code, e]) => ({ code, label: e.label, notes: e.notes.size, value: e.value, share: total > 0 ? e.value / total : 0 }))
    .sort((a, b) => b.value - a.value);
}

export function codeBreakdown(rows: FiscalItemRow[], month: string, kind: FiscalCodeKind): CodeBreakdown {
  const set = rows.filter((r) => r.issueMonth === month && !r.cancelled && rowKind(r) === kind);
  return {
    byNcm: group(set, (r) => r.ncm || "sem NCM", (r) => r.description),
    byCfop: group(set, (r) => r.cfop, (r) => CFOP_LABELS[r.cfop] ?? "—"),
    byIcmsCode: group(set, (r) => icmsCodeKey(r.icmsCode), (r) => icmsCodeLabel(r.icmsCode)),
  };
}
