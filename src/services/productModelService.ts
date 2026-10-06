import { prisma } from "@/lib/prisma";
import { marketplaceSaleRepository } from "@/repositories/marketplaceSaleRepository";
import { aggregateSalesBySku } from "@/domain/salesAggregation";
import { FLEX_COST_PER_PACKAGE } from "@/domain/breakEven";
import { buildProductModels, itemKeys, kitCost, normalizeKey, parseSku, type ModelSkuInput, type PieceCost } from "@/domain/productModels";
import { todayUTCInBrazil } from "@/lib/today";
import { mlAdSpendRepository } from "@/repositories/mlAdSpendRepository";
import { allocateAdSpendBySku, overlapShare, ownedShareByReport } from "@/domain/adSpendAllocation";

/** Janela de vendas que a tela usa pra ordenar os modelos e mostrar a margem. */
export const MODEL_SALES_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

async function loadRows(): Promise<ModelSkuInput[]> {
  const now = todayUTCInBrazil();
  const start = new Date(now.getTime() - MODEL_SALES_DAYS * DAY_MS);
  const [products, sales] = await Promise.all([
    prisma.product.findMany({
      where: { sku: { not: null } },
      select: { id: true, sku: true, name: true, tecidoCost: true, costuraCost: true, aviamentosCost: true, packagingCost: true },
    }),
    marketplaceSaleRepository.findByPeriod(start, now),
  ]);

  // Ads do período, rateado por SKU como na Lucratividade.
  const listingCodes = [...new Set(sales.map((s) => s.listingCode).filter((c): c is string => !!c))];
  const adRows = listingCodes.length ? await mlAdSpendRepository.findByListingCodesAndPeriod(listingCodes, start, now) : [];
  const ownedAd = ownedShareByReport(adRows);
  const adSpendBySku = allocateAdSpendBySku(
    sales.map((s) => ({ sku: s.sku, listingCode: s.listingCode, grossRevenue: Number(s.grossRevenue) })),
    adRows.map((r, i) => ({
      listingCode: r.listingCode,
      investimento: Number(r.investimento) * overlapShare(r.periodStart, r.periodEnd, start, now) * ownedAd[i],
    })),
  );

  const aggregates = aggregateSalesBySku(
    sales.map((s) => ({
      sku: s.sku,
      productName: s.productName,
      quantity: s.quantity,
      grossRevenue: Number(s.grossRevenue),
      netRevenue: Number(s.netRevenue),
      marketplaceCost: Number(s.marketplaceCost),
      status: s.status,
      shippingModality: s.shippingModality,
    })),
  );

  const bySku = new Map<string, ModelSkuInput>();
  // Embalagem por peça: não é custo de produção do modelo, então entra como desconto da venda (como o Flex).
  const packagingBySku = new Map(products.map((p) => [p.sku!.trim().toUpperCase(), Number(p.packagingCost)]));
  for (const p of products) {
    bySku.set(p.sku!.trim().toUpperCase(), {
      sku: p.sku!,
      name: p.name,
      productId: p.id,
      cost: {
        tecidoCost: Number(p.tecidoCost),
        costuraCost: Number(p.costuraCost),
        aviamentosCost: Number(p.aviamentosCost),
      },
      quantity: 0,
      grossRevenue: 0,
      beforeProductionCost: 0,
    });
  }
  for (const a of aggregates) {
    const key = a.sku.trim().toUpperCase();
    // Mesma conta do Ponto de Equilíbrio: o que sobrou da venda no Mercado
    // Turbo, com o custo dele somado de volta e o Flex descontado.
    const beforeProductionCost =
      a.netRevenue + a.marketplaceCost - a.flexOrderCount * FLEX_COST_PER_PACKAGE - a.quantity * (packagingBySku.get(key) ?? 0);
    const existing = bySku.get(key);
    if (existing) {
      bySku.set(key, {
        ...existing,
        quantity: a.quantity,
        grossRevenue: a.grossRevenue,
        beforeProductionCost,
        adSpend: adSpendBySku.get(a.sku) ?? 0,
      });
    } else {
      bySku.set(key, {
        sku: a.sku,
        name: a.name,
        productId: null,
        cost: null,
        quantity: a.quantity,
        grossRevenue: a.grossRevenue,
        beforeProductionCost,
        adSpend: adSpendBySku.get(a.sku) ?? 0,
      });
    }
  }
  return [...bySku.values()];
}

export type ApplyModelCostInput = {
  modelKey: string;
  skus: string[];
  cost: PieceCost;
  /** Atualiza também os kits de quantidade (5.X) dos SKUs aplicados. */
  includeKits: boolean;
};

export const productModelService = {
  async list() {
    return { days: MODEL_SALES_DAYS, models: buildProductModels(await loadRows()) };
  },

  async applyCost(input: ApplyModelCostInput) {
    const rows = await loadRows();
    const models = buildProductModels(rows);
    const model = models.find((m) => m.key === input.modelKey);
    if (!model) throw new Error(`Modelo ${input.modelKey} não encontrado.`);

    const wanted = new Set(input.skus.map((s) => s.trim().toUpperCase()));
    const wantedItems = new Set(input.skus.flatMap(itemKeys));
    const targets: { row: ModelSkuInput; cost: PieceCost }[] = model.skus
      .filter((s) => wanted.has(s.sku.trim().toUpperCase()))
      .map((s) => ({ row: s, cost: input.cost }));

    if (input.includeKits) {
      const rowBySku = new Map(rows.map((r) => [r.sku.trim().toUpperCase(), r]));
      for (const kit of model.kits) {
        if (!wantedItems.has(normalizeKey(kit.itemSku))) continue;
        const row = rowBySku.get(kit.sku);
        if (row) targets.push({ row, cost: kitCost(input.cost, kit.quantity) });
      }
    }

    let created = 0;
    let updated = 0;
    for (const { row, cost } of targets) {
      if (row.productId) {
        await prisma.product.update({ where: { id: row.productId }, data: cost });
        updated++;
      } else {
        // SKU vendido que ainda não existe em Produtos: cria com o preço médio
        // de venda do período, que é o que as telas de cadastro esperam.
        const salePrice = row.quantity > 0 ? Math.round((row.grossRevenue / row.quantity) * 100) / 100 : 0;
        await prisma.product.create({ data: { sku: row.sku, name: row.name || row.sku, salePrice, ...cost } });
        created++;
      }
    }
    return { created, updated, kits: targets.filter((t) => parseSku(t.row.sku).kit !== null).length };
  },
};
