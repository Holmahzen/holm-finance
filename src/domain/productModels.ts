/**
 * Agrupa SKUs por modelo pra cadastrar custo uma vez só: os tamanhos de um
 * mesmo modelo (COUM.1000G, COUM.1000M, COUM.1000EG) quase sempre custam o
 * mesmo, e cadastrar 231 SKUs um a um é o que trava o cadastro hoje.
 *
 * Também reconhece kits de quantidade pelo prefixo ("5.TO1001" = 5 × TO1001),
 * que têm o custo calculado a partir do item. Kits mistos (saia + pano + pano)
 * não dá pra deduzir do SKU — ficam como modelo comum.
 */

/** Do mais longo pro mais curto, senão "GG" casaria como "G". */
const LETTER_SIZES = ["EGG", "XGG", "GG", "EG", "XG", "PP", "G1", "G2", "G3", "G4", "P", "M", "G"];

// Tamanho em letra colado num número ou depois de separador, com sufixo
// opcional depois dele (CCCZE.1000M.CHP = modelo CCCZE.1000.CHP, tamanho M).
const LETTER_SIZE_RE = new RegExp(`^(.+?[\\d.\\-_])(${LETTER_SIZES.join("|")})((?:\\.[A-Z]{2,4})?)$`);
// Tamanho infantil numérico só depois de separador (JAINF1000.6) — "TOTAC.1001"
// não é tamanho 01.
const NUMERIC_SIZE_RE = /^(.*[A-Z].*?)[.\-_](\d{1,2})$/;
// Kit de quantidade: "5.TO1001", "10.TOTAC1001".
const QUANTITY_KIT_RE = /^(\d{1,3})\.(.+)$/;

/**
 * Os SKUs não seguem uma grafia só (TOTAC.1001, TOTAC1001, TO.TAC1001 são a
 * mesma touca): agrupa ignorando ponto, hífen e outros símbolos.
 */
export function normalizeKey(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export type ParsedSku = {
  sku: string;
  /** Chave de agrupamento, sem pontuação. */
  modelKey: string;
  /** Como o modelo aparece escrito no SKU (pra mostrar na tela). */
  modelLabel: string;
  size: string | null;
  /** Kit de N unidades do mesmo item; null se não for kit de quantidade. */
  kit: { quantity: number; itemSku: string } | null;
};

function stripSeparator(base: string): string {
  return base.replace(/[.\-_]$/, "");
}

function splitSize(sku: string): { modelKey: string; size: string | null } {
  const letter = LETTER_SIZE_RE.exec(sku);
  if (letter) return { modelKey: stripSeparator(letter[1]) + letter[3], size: letter[2] };
  const numeric = NUMERIC_SIZE_RE.exec(sku);
  if (numeric) return { modelKey: numeric[1], size: numeric[2] };
  return { modelKey: sku, size: null };
}

export function parseSku(rawSku: string): ParsedSku {
  const sku = rawSku.trim().toUpperCase();
  const kit = QUANTITY_KIT_RE.exec(sku);
  if (kit && Number(kit[1]) >= 2) {
    const quantity = Number(kit[1]);
    const itemSku = kit[2];
    const { modelKey, size } = splitSize(itemSku);
    return {
      sku,
      modelKey: `${quantity}.${normalizeKey(modelKey)}`,
      modelLabel: `${quantity}.${modelKey}`,
      size,
      kit: { quantity, itemSku },
    };
  }
  const { modelKey, size } = splitSize(sku);
  return { sku, modelKey: normalizeKey(modelKey), modelLabel: modelKey, size, kit: null };
}

export type PieceCost = { tecidoCost: number; costuraCost: number; aviamentosCost: number };

export function totalCost(c: PieceCost): number {
  return c.tecidoCost + c.costuraCost + c.aviamentosCost;
}

export function kitCost(item: PieceCost, quantity: number): PieceCost {
  const round = (v: number) => Math.round(v * quantity * 100) / 100;
  return {
    tecidoCost: round(item.tecidoCost),
    costuraCost: round(item.costuraCost),
    aviamentosCost: round(item.aviamentosCost),
  };
}

export type ModelSkuInput = {
  sku: string;
  name: string;
  productId: string | null;
  cost: PieceCost | null;
  quantity: number;
  grossRevenue: number;
  /** O que sobrou das vendas antes do custo de produção (ver computeSalesBasedMargin). */
  beforeProductionCost: number;
  /** Investimento em Ads rateado pra esse SKU no período. */
  adSpend?: number;
};

export type ModelSku = ModelSkuInput & { size: string | null; kit: ParsedSku["kit"] };

export type ProductModel = {
  key: string;
  label: string;
  name: string;
  skus: ModelSku[];
  quantity: number;
  grossRevenue: number;
  beforeProductionCost: number;
  adSpend: number;
  /** "igual" quando todos os SKUs têm o mesmo custo, "diferente", "parcial" (alguns sem) ou "sem". */
  costStatus: "igual" | "diferente" | "parcial" | "sem";
  /** Custo que a tela sugere editar: o do SKU com custo que mais vendeu. */
  referenceCost: PieceCost | null;
  /** Kits de quantidade (5.X) cujo item é um SKU deste modelo. */
  kits: { sku: string; quantity: number; itemSku: string }[];
  /** Margem real no período com o custo atual; null sem venda ou sem custo. */
  marginPercent: number | null;
};

function sameCost(a: PieceCost, b: PieceCost): boolean {
  return (
    Math.abs(a.tecidoCost - b.tecidoCost) < 0.005 &&
    Math.abs(a.costuraCost - b.costuraCost) < 0.005 &&
    Math.abs(a.aviamentosCost - b.aviamentosCost) < 0.005
  );
}

const SIZE_ORDER = ["PP", "P", "M", "G", "GG", "XG", "EG", "XGG", "EGG", "G1", "G2", "G3", "G4"];
function sizeRank(size: string | null): number {
  if (size === null) return -1;
  if (/^\d+$/.test(size)) return Number(size);
  const i = SIZE_ORDER.indexOf(size);
  return 100 + (i === -1 ? SIZE_ORDER.length : i);
}

export function buildProductModels(rows: ModelSkuInput[]): ProductModel[] {
  const parsedBySku = new Map(rows.map((r) => [r.sku.trim().toUpperCase(), parseSku(r.sku)]));
  const groups = new Map<string, ModelSku[]>();
  for (const r of rows) {
    const parsed = parsedBySku.get(r.sku.trim().toUpperCase())!;
    const list = groups.get(parsed.modelKey) ?? [];
    list.push({ ...r, size: parsed.size, kit: parsed.kit });
    groups.set(parsed.modelKey, list);
  }

  const kitsByItemSku = new Map<string, { sku: string; quantity: number; itemSku: string }[]>();
  for (const parsed of parsedBySku.values()) {
    if (!parsed.kit) continue;
    const itemKey = normalizeKey(parsed.kit.itemSku);
    const list = kitsByItemSku.get(itemKey) ?? [];
    list.push({ sku: parsed.sku, quantity: parsed.kit.quantity, itemSku: parsed.kit.itemSku });
    kitsByItemSku.set(itemKey, list);
  }

  const models: ProductModel[] = [];
  for (const [key, skus] of groups) {
    skus.sort((a, b) => sizeRank(a.size) - sizeRank(b.size) || a.sku.localeCompare(b.sku));
    const costed = skus.filter((s) => s.cost !== null && totalCost(s.cost) > 0);
    const costStatus: ProductModel["costStatus"] =
      costed.length === 0
        ? "sem"
        : costed.length < skus.length
          ? "parcial"
          : costed.every((s) => sameCost(s.cost!, costed[0].cost!))
            ? "igual"
            : "diferente";
    const reference = [...costed].sort((a, b) => b.quantity - a.quantity)[0] ?? null;
    const top = [...skus].sort((a, b) => b.grossRevenue - a.grossRevenue)[0];

    const quantity = skus.reduce((sum, s) => sum + s.quantity, 0);
    const grossRevenue = skus.reduce((sum, s) => sum + s.grossRevenue, 0);
    const beforeProductionCost = skus.reduce((sum, s) => sum + s.beforeProductionCost, 0);
    const adSpend = skus.reduce((sum, s) => sum + (s.adSpend ?? 0), 0);
    const soldCosted = skus.filter((s) => s.quantity > 0 && s.cost !== null && totalCost(s.cost) > 0);
    const soldCostedRevenue = soldCosted.reduce((sum, s) => sum + s.grossRevenue, 0);
    const marginPercent =
      soldCostedRevenue > 0
        ? soldCosted.reduce((sum, s) => sum + s.beforeProductionCost - totalCost(s.cost!) * s.quantity, 0) /
          soldCostedRevenue
        : null;

    models.push({
      key,
      label: parsedBySku.get(top.sku.trim().toUpperCase())!.modelLabel,
      name: top.name,
      skus,
      quantity,
      grossRevenue,
      beforeProductionCost,
      adSpend,
      costStatus,
      referenceCost: reference?.cost ?? null,
      // Duas grafias do mesmo item (TOTAC.1001 e TO.TAC1001) apontam pro mesmo kit.
      kits: [...new Map(skus.flatMap((s) => kitsByItemSku.get(normalizeKey(s.sku)) ?? []).map((k) => [k.sku, k])).values()],
      marginPercent,
    });
  }

  return models.sort((a, b) => b.grossRevenue - a.grossRevenue || a.key.localeCompare(b.key));
}
