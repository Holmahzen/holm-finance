import { describe, it, expect } from "vitest";
import { buildProductModels, kitCost, parseSku, type ModelSkuInput } from "@/domain/productModels";

describe("parseSku", () => {
  it.each([
    ["COUM.1000G", "COUM.1000", "G"],
    ["COUM.1000EG", "COUM.1000", "EG"],
    ["JALE1000GG", "JALE1000", "GG"],
    ["JALE1001M", "JALE1001", "M"],
    ["JAINF1000.6", "JAINF1000", "6"],
    ["JAINF1000.10", "JAINF1000", "10"],
    ["CCABA.P", "CCABA", "P"],
    ["KITGI.1001P", "KITGI.1001", "P"],
    ["KITUMB4.M", "KITUMB4", "M"],
    ["CCCZE.1000M.CHP", "CCCZE.1000.CHP", "M"],
    ["CALU1000.EG", "CALU1000", "EG"],
  ])("%s é o tamanho %s do modelo", (sku, model, size) => {
    expect(parseSku(sku)).toMatchObject({ modelLabel: model, size, kit: null });
  });

  it.each(["TOTAC.1001", "V-SAIA1000.1000", "KITUMB3.1000", "EKETE1001", "V-PANOCABECA1000"])("%s não tem tamanho", (sku) => {
    expect(parseSku(sku)).toMatchObject({ modelLabel: sku, size: null });
  });

  it("reconhece kit de quantidade pelo prefixo", () => {
    expect(parseSku("5.TO1001")).toEqual({
      sku: "5.TO1001",
      modelKey: "5.TO1001",
      modelLabel: "5.TO1001",
      size: null,
      kit: { quantity: 5, itemSku: "TO1001" },
    });
    expect(parseSku("10.TOTAC1001").kit).toEqual({ quantity: 10, itemSku: "TOTAC1001" });
  });

  it("kit de quantidade com tamanho agrupa os tamanhos do kit", () => {
    expect(parseSku("3.JALE1000M")).toMatchObject({ modelLabel: "3.JALE1000", size: "M", kit: { quantity: 3, itemSku: "JALE1000M" } });
  });
});

describe("kitCost", () => {
  it("multiplica cada parte do custo pela quantidade", () => {
    expect(kitCost({ tecidoCost: 2.5, costuraCost: 1.1, aviamentosCost: 0.33 }, 5)).toEqual({
      tecidoCost: 12.5,
      costuraCost: 5.5,
      aviamentosCost: 1.65,
    });
  });
});

function row(overrides: Partial<ModelSkuInput> & { sku: string }): ModelSkuInput {
  return {
    name: "Produto",
    productId: null,
    cost: null,
    quantity: 0,
    grossRevenue: 0,
    beforeProductionCost: 0,
    ...overrides,
  };
}

describe("buildProductModels", () => {
  const cost = { tecidoCost: 10, costuraCost: 5, aviamentosCost: 2 };

  it("junta os tamanhos, ordena P→EG e calcula a margem real do modelo", () => {
    const [model] = buildProductModels([
      row({ sku: "COUM.1000EG", cost, quantity: 10, grossRevenue: 600, beforeProductionCost: 300 }),
      row({ sku: "COUM.1000M", cost, quantity: 20, grossRevenue: 1200, beforeProductionCost: 600 }),
    ]);
    expect(model.label).toBe("COUM.1000");
    expect(model.skus.map((s) => s.size)).toEqual(["M", "EG"]);
    expect(model.costStatus).toBe("igual");
    // (900 - 17 × 30) / 1800
    expect(model.marginPercent).toBeCloseTo((900 - 17 * 30) / 1800);
  });

  it("marca parcial quando um tamanho ainda não tem custo e usa o mais vendido como referência", () => {
    const [model] = buildProductModels([
      row({ sku: "JALE1000M", cost, quantity: 5 }),
      row({ sku: "JALE1000G", cost: { ...cost, tecidoCost: 12 }, quantity: 9 }),
      row({ sku: "JALE1000GG" }),
    ]);
    expect(model.costStatus).toBe("parcial");
    expect(model.referenceCost?.tecidoCost).toBe(12);
  });

  it("liga o kit de quantidade ao modelo do item", () => {
    const models = buildProductModels([
      row({ sku: "TO1001", cost, grossRevenue: 100 }),
      row({ sku: "5.TO1001", grossRevenue: 50 }),
    ]);
    const item = models.find((m) => m.key === "TO1001")!;
    expect(item.kits).toEqual([{ sku: "5.TO1001", quantity: 5, itemSku: "TO1001" }]);
  });

  it("junta grafias diferentes do mesmo SKU e liga o kit ao item mesmo com outra pontuação", () => {
    const models = buildProductModels([
      row({ sku: "TOTAC.1001", cost, grossRevenue: 100 }),
      row({ sku: "TO.TAC1001", grossRevenue: 10 }),
      row({ sku: "2.TOTAC1001", grossRevenue: 50 }),
    ]);
    const item = models.find((m) => m.key === "TOTAC1001")!;
    expect(item.skus.map((s) => s.sku)).toEqual(["TO.TAC1001", "TOTAC.1001"]);
    expect(item.kits).toEqual([{ sku: "2.TOTAC1001", quantity: 2, itemSku: "TOTAC1001" }]);
  });

  describe("custo calculado do kit sem custo", () => {
    const unit = { tecidoCost: 0.16, costuraCost: 1.1, aviamentosCost: 1.65 };

    it("multiplica a quantidade do SKU pelo custo do item unitário V-", () => {
      const models = buildProductModels([
        row({ sku: "V-TO1001", cost: unit, quantity: 840, grossRevenue: 100 }),
        row({ sku: "15.TO1001", quantity: 1, grossRevenue: 97.9 }),
      ]);
      const kit = models.find((m) => m.key === "15.TO1001")!;
      expect(kit.costStatus).toBe("sem");
      expect(kit.suggestedFrom).toBe("V-TO1001");
      expect(kit.suggestedCost).toEqual({ tecidoCost: 2.4, costuraCost: 16.5, aviamentosCost: 24.75 });
    });

    it("prefere o item que mais vendeu quando TO1001 e V-TO1001 existem", () => {
      const [kit] = buildProductModels([
        row({ sku: "TO1001", cost: { ...unit, tecidoCost: 9 }, quantity: 0 }),
        row({ sku: "V-TO1001", cost: unit, quantity: 840 }),
        row({ sku: "15.TO1001" }),
      ]).filter((m) => m.key === "15.TO1001");
      expect(kit.suggestedFrom).toBe("V-TO1001");
      expect(kit.suggestedCost?.tecidoCost).toBe(2.4);
    });

    it("liga os kits ao modelo do V- e não sugere nada se o kit já tem custo ou o item não tem", () => {
      const models = buildProductModels([
        row({ sku: "V-TO1001", cost: unit }),
        row({ sku: "5.TO1001", cost: { tecidoCost: 0.8, costuraCost: 5.5, aviamentosCost: 8.25 } }),
        row({ sku: "10.TOTAC1001" }),
      ]);
      expect(models.find((m) => m.key === "VTO1001")!.kits.map((k) => k.sku)).toEqual(["5.TO1001"]);
      expect(models.find((m) => m.key === "5.TO1001")!.suggestedCost).toBeNull();
      expect(models.find((m) => m.key === "10.TOTAC1001")!.suggestedCost).toBeNull();
    });
  });
});
