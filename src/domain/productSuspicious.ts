import { looksLikeNumericName } from "@/domain/bulkProductPaste";

export type SuspiciousProduct = {
  id: string;
  sku: string;
  currentName: string;
  suggestedName: string | null;
  salePrice: number;
  tecidoCost: number;
  costuraCost: number;
  aviamentosCost: number;
};

/** Produtos ativos cujo nome cadastrado é, na prática, um número — sintoma
 * da coluna Nome ter faltado numa colagem antiga (ver bulkProductPaste.ts). */
export function findNumericNamedProducts<
  T extends { id: string; sku: string | null; name: string; isActive: boolean },
>(products: T[]): T[] {
  return products.filter((p) => p.isActive && p.sku && looksLikeNumericName(p.name));
}

/** Pro nome sugerido, usa o mais frequente nas vendas daquele SKU (o "quase
 * sempre chamado assim"), não o mais recente — um título digitado errado uma
 * vez só no ML não deveria virar a sugestão. */
export function pickSuggestedNames(sales: { sku: string; productName: string }[]): Map<string, string> {
  const counts = new Map<string, Map<string, number>>();
  for (const s of sales) {
    if (!s.productName.trim()) continue;
    const bySku = counts.get(s.sku) ?? counts.set(s.sku, new Map()).get(s.sku)!;
    bySku.set(s.productName, (bySku.get(s.productName) ?? 0) + 1);
  }

  const result = new Map<string, string>();
  for (const [sku, names] of counts) {
    const [bestName] = [...names.entries()].sort((a, b) => b[1] - a[1])[0];
    result.set(sku, bestName);
  }
  return result;
}
