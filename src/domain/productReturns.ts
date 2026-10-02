import { rowKind, type FiscalItemRow } from "@/domain/fiscalNotes";
import { normalizeKey, parseSku, sizeRank } from "@/domain/productModels";

/**
 * Devoluções por produto, pelas notas fiscais: as de venda (saída) e as de
 * devolução (entrada própria ou a que o Mercado Livre emite em nome do
 * comprador), cruzadas pelo código do produto — que nas notas da Holm é o SKU.
 *
 * A devolução de um mês costuma ser de venda de mês anterior, por isso a taxa
 * faz mais sentido numa janela de alguns meses do que num mês só.
 */

export type ProductMovementRow = FiscalItemRow & { productCode: string; quantity: number };

export type SizeReturns = {
  sku: string;
  size: string | null;
  soldQty: number;
  soldValue: number;
  returnedQty: number;
  returnedValue: number;
  /** Peças devolvidas ÷ vendidas; null sem venda no período. */
  returnRate: number | null;
};

export type ModelReturns = {
  key: string;
  label: string;
  name: string;
  soldQty: number;
  soldValue: number;
  returnedQty: number;
  returnedValue: number;
  returnRate: number | null;
  sizes: SizeReturns[];
};

export type ProductReturnsReport = {
  soldQty: number;
  soldValue: number;
  returnedQty: number;
  returnedValue: number;
  returnRate: number | null;
  models: ModelReturns[];
  /** Devoluções cujo código não aparece em nenhuma venda do período (código diferente do SKU, ou venda mais antiga). */
  unmatched: { code: string; description: string; returnedQty: number; returnedValue: number }[];
};

const rate = (returned: number, sold: number) => (sold > 0 ? returned / sold : null);

export function buildProductReturns(rows: ProductMovementRow[]): ProductReturnsReport {
  type Acc = { sku: string; description: string; soldQty: number; soldValue: number; returnedQty: number; returnedValue: number };
  const bySku = new Map<string, Acc>();

  for (const row of rows) {
    if (row.cancelled) continue;
    const kind = rowKind(row);
    if (kind !== "sale" && kind !== "return") continue;
    const code = row.productCode.trim();
    if (!code) continue;
    const key = normalizeKey(code);
    const acc = bySku.get(key) ?? { sku: code.toUpperCase(), description: row.description, soldQty: 0, soldValue: 0, returnedQty: 0, returnedValue: 0 };
    if (kind === "sale") {
      acc.soldQty += row.quantity;
      acc.soldValue += row.netValue;
      // O nome e a grafia do SKU vêm da nota de venda, que é a da Holm.
      acc.description = row.description;
      acc.sku = code.toUpperCase();
    } else {
      acc.returnedQty += row.quantity;
      acc.returnedValue += row.netValue;
    }
    bySku.set(key, acc);
  }

  const unmatched: ProductReturnsReport["unmatched"] = [];
  const models = new Map<string, ModelReturns>();
  for (const acc of bySku.values()) {
    if (acc.soldQty === 0) {
      unmatched.push({ code: acc.sku, description: acc.description, returnedQty: acc.returnedQty, returnedValue: acc.returnedValue });
      continue;
    }
    const parsed = parseSku(acc.sku);
    const model =
      models.get(parsed.modelKey) ??
      models
        .set(parsed.modelKey, {
          key: parsed.modelKey,
          label: parsed.modelLabel,
          name: acc.description,
          soldQty: 0,
          soldValue: 0,
          returnedQty: 0,
          returnedValue: 0,
          returnRate: null,
          sizes: [],
        })
        .get(parsed.modelKey)!;
    model.sizes.push({
      sku: acc.sku,
      size: parsed.size,
      soldQty: acc.soldQty,
      soldValue: acc.soldValue,
      returnedQty: acc.returnedQty,
      returnedValue: acc.returnedValue,
      returnRate: rate(acc.returnedQty, acc.soldQty),
    });
    model.soldQty += acc.soldQty;
    model.soldValue += acc.soldValue;
    model.returnedQty += acc.returnedQty;
    model.returnedValue += acc.returnedValue;
  }

  const modelList = [...models.values()]
    .map((m) => ({
      ...m,
      returnRate: rate(m.returnedQty, m.soldQty),
      sizes: m.sizes.sort((a, b) => sizeRank(a.size) - sizeRank(b.size) || a.sku.localeCompare(b.sku)),
    }))
    .sort((a, b) => b.returnedValue - a.returnedValue || b.soldValue - a.soldValue);

  const soldQty = modelList.reduce((s, m) => s + m.soldQty, 0);
  const soldValue = modelList.reduce((s, m) => s + m.soldValue, 0);
  const returnedQty = modelList.reduce((s, m) => s + m.returnedQty, 0) + unmatched.reduce((s, u) => s + u.returnedQty, 0);
  const returnedValue = modelList.reduce((s, m) => s + m.returnedValue, 0) + unmatched.reduce((s, u) => s + u.returnedValue, 0);

  return {
    soldQty,
    soldValue,
    returnedQty,
    returnedValue,
    returnRate: rate(returnedQty, soldQty),
    models: modelList,
    unmatched: unmatched.sort((a, b) => b.returnedValue - a.returnedValue),
  };
}
