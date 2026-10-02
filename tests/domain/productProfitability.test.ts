import { describe, it, expect } from "vitest";
import {
  classifyAbc,
  classifyQuadrant,
  suggestMarginThreshold,
  buildProfitabilityReport,
  type SkuAbc,
} from "@/domain/productProfitability";
import type { SkuSalesAggregate } from "@/domain/salesAggregation";
import type { ProductionCost } from "@/domain/breakEven";

function sku(overrides: Partial<SkuSalesAggregate> = {}): SkuSalesAggregate {
  return {
    sku: "A1",
    name: "Produto A",
    quantity: 1,
    grossRevenue: 100,
    netRevenue: 80,
    marketplaceCost: 20,
    flexOrderCount: 0,
    ...overrides,
  };
}

function cost(overrides: Partial<ProductionCost> = {}): ProductionCost {
  return { tecidoCost: 20, costuraCost: 10, aviamentosCost: 5, ...overrides };
}

/** 10 peças a R$ 100: sobram R$ 81/peça depois de imposto/tarifa/frete (Mercado Turbo). */
function soldA1(overrides: Partial<SkuSalesAggregate> = {}): SkuSalesAggregate {
  return sku({ sku: "A1", grossRevenue: 1000, quantity: 10, netRevenue: 500, marketplaceCost: 310, ...overrides });
}

describe("classifyAbc", () => {
  it("marca classe A ate 80% da receita acumulada, B ate 95%, C o resto", () => {
    const skus = [
      sku({ sku: "BIG", grossRevenue: 800 }),
      sku({ sku: "MED", grossRevenue: 150 }),
      sku({ sku: "SMALL", grossRevenue: 50 }),
    ];
    const result = classifyAbc(skus);
    const bySku = Object.fromEntries(result.map((r) => [r.sku, r]));
    expect(bySku.BIG.tier).toBe("A");
    expect(bySku.BIG.cumulativeShare).toBeCloseTo(0.8);
    expect(bySku.MED.tier).toBe("B");
    expect(bySku.MED.cumulativeShare).toBeCloseTo(0.95);
    expect(bySku.SMALL.tier).toBe("C");
    expect(bySku.SMALL.cumulativeShare).toBeCloseTo(1);
  });

  it("ordena por receita bruta decrescente independente da ordem de entrada", () => {
    const skus = [sku({ sku: "SMALL", grossRevenue: 10 }), sku({ sku: "BIG", grossRevenue: 90 })];
    const result = classifyAbc(skus);
    expect(result.map((r) => r.sku)).toEqual(["BIG", "SMALL"]);
  });

  it("nao quebra com receita total zero", () => {
    const result = classifyAbc([sku({ grossRevenue: 0 })]);
    expect(result[0].revenueShare).toBe(0);
  });
});

describe("classifyQuadrant", () => {
  it("classifica sem custo cadastrado antes de tudo", () => {
    expect(classifyQuadrant("A", 0.5, false, 0.3)).toBe("SEM_CUSTO");
  });

  it("classe A com margem boa vira Estrela", () => {
    expect(classifyQuadrant("A", 0.4, true, 0.3)).toBe("ESTRELA");
  });

  it("classe A com margem abaixo do limite vira motor de margem apertada", () => {
    expect(classifyQuadrant("A", 0.2, true, 0.3)).toBe("MOTOR_MARGEM_APERTADA");
  });

  it("classe B/C com margem boa vira nicho rentavel", () => {
    expect(classifyQuadrant("B", 0.4, true, 0.3)).toBe("NICHO_RENTAVEL");
    expect(classifyQuadrant("C", 0.4, true, 0.3)).toBe("NICHO_RENTAVEL");
  });

  it("classe B/C com margem baixa vira reavaliar", () => {
    expect(classifyQuadrant("C", 0.1, true, 0.3)).toBe("REAVALIAR");
  });
});

describe("suggestMarginThreshold", () => {
  it("calcula a mediana de uma lista impar", () => {
    expect(suggestMarginThreshold([0.1, 0.5, 0.3])).toBe(0.3);
  });

  it("calcula a mediana de uma lista par como a media dos dois do meio", () => {
    expect(suggestMarginThreshold([0.1, 0.2, 0.3, 0.4])).toBeCloseTo(0.25);
  });

  it("volta 0 pra lista vazia", () => {
    expect(suggestMarginThreshold([])).toBe(0);
  });
});

describe("buildProfitabilityReport", () => {
  it("junta vendas e custo, calcula contribuicao e classifica cada linha", () => {
    const skus = [soldA1()];
    const products = new Map([["A1", cost()]]);
    const { rows } = buildProfitabilityReport(skus, products, 0.3);
    expect(rows).toHaveLength(1);
    expect(rows[0].hasCost).toBe(true);
    expect(rows[0].marginValue).toBeCloseTo(46); // (500 + 310) / 10 - (20+10+5)
    expect(rows[0].contribution).toBeCloseTo(460); // 46 * 10
    expect(rows[0].quadrant).toBe("ESTRELA"); // classe A (unico SKU) + margem 46% >= 30%
  });

  it("marca SEM_CUSTO quando o SKU vendido nao tem produto cadastrado", () => {
    const skus = [sku({ sku: "SEM-CADASTRO" })];
    const { rows } = buildProfitabilityReport(skus, new Map(), 0.3);
    expect(rows[0].hasCost).toBe(false);
    expect(rows[0].quadrant).toBe("SEM_CUSTO");
    expect(rows[0].contribution).toBe(0);
  });

  it("usa a mediana como limite quando marginThreshold nao e informado", () => {
    const skus: SkuSalesAggregate[] = [
      sku({ sku: "A1", grossRevenue: 600, netRevenue: 480, marketplaceCost: 0 }),
      sku({ sku: "A2", grossRevenue: 400, netRevenue: 140, marketplaceCost: 0 }),
    ];
    const products = new Map([
      ["A1", cost({ tecidoCost: 0, costuraCost: 0, aviamentosCost: 0 })], // 480 / 600 = 80%
      ["A2", cost({ tecidoCost: 60, costuraCost: 0, aviamentosCost: 0 })], // 80 / 400 = 20%
    ]);
    const { suggestedMarginThreshold } = buildProfitabilityReport(skus, products);
    expect(suggestedMarginThreshold).toBeCloseTo(0.5); // mediana entre 0.8 e 0.2
  });

  it("classifyAbc puro continua acessivel (exportado) pra reuso", () => {
    const result: SkuAbc[] = classifyAbc([sku()]);
    expect(result[0].tier).toBe("A");
  });

  it("desconta o investimento em Ads da contribuicao quando o SKU tem gasto no periodo", () => {
    const skus = [soldA1()];
    const products = new Map([["A1", cost()]]);
    const adSpendBySku = new Map([["A1", 150]]);
    const { rows } = buildProfitabilityReport(skus, products, 0.3, adSpendBySku);
    expect(rows[0].contribution).toBeCloseTo(460); // 46 * 10, sem desconto de Ads
    expect(rows[0].adSpend).toBe(150);
    expect(rows[0].contributionAfterAds).toBeCloseTo(310); // 460 - 150
  });

  it("adSpend e contributionAfterAds ficam zero/iguais a contribution quando nao ha gasto de Ads pro SKU", () => {
    const skus = [soldA1()];
    const products = new Map([["A1", cost()]]);
    const { rows } = buildProfitabilityReport(skus, products, 0.3);
    expect(rows[0].adSpend).toBe(0);
    expect(rows[0].contributionAfterAds).toBeCloseTo(rows[0].contribution);
  });

  it("calcula adSharePercent como a fracao da contribuicao comida pelo Ads", () => {
    const skus = [soldA1()];
    const products = new Map([["A1", cost()]]);
    const adSpendBySku = new Map([["A1", 230]]); // metade da contribuicao de 460
    const { rows } = buildProfitabilityReport(skus, products, 0.3, adSpendBySku);
    expect(rows[0].adSharePercent).toBeCloseTo(0.5);
  });

  it("adSharePercent fica null quando a contribuicao nao e positiva (produto ja deficitario sem contar Ads)", () => {
    const skus = [soldA1()];
    const products = new Map([["A1", cost({ tecidoCost: 90 })]]); // 81 - 105: margem negativa
    const adSpendBySku = new Map([["A1", 50]]);
    const { rows } = buildProfitabilityReport(skus, products, 0.3, adSpendBySku);
    expect(rows[0].contribution).toBeLessThanOrEqual(0);
    expect(rows[0].adSharePercent).toBeNull();
  });

  it("desconta o custo Full da contribuicao final quando o SKU teve custo Full no periodo", () => {
    const skus = [soldA1()];
    const products = new Map([["A1", cost()]]);
    const adSpendBySku = new Map([["A1", 150]]);
    const fullCostBySku = new Map([["A1", 40]]);
    const { rows } = buildProfitabilityReport(skus, products, 0.3, adSpendBySku, fullCostBySku);
    expect(rows[0].fullCost).toBe(40);
    expect(rows[0].contributionAfterAds).toBeCloseTo(310); // 460 - 150, nao afetado pelo Full
    expect(rows[0].contributionFinal).toBeCloseTo(270); // 460 - 150 - 40
  });

  it("fullCost e contributionFinal ficam zero/iguais a contributionAfterAds quando nao ha custo Full pro SKU", () => {
    const skus = [soldA1()];
    const products = new Map([["A1", cost()]]);
    const { rows } = buildProfitabilityReport(skus, products, 0.3);
    expect(rows[0].fullCost).toBe(0);
    expect(rows[0].contributionFinal).toBeCloseTo(rows[0].contributionAfterAds);
  });

  it("usa a venda real, não o preço do cadastro, e desconta o Flex", () => {
    const { rows } = buildProfitabilityReport([soldA1({ flexOrderCount: 2 })], new Map([["A1", cost()]]), 0.3);
    // (500 + 310 - 2 × 12,99) / 10 - 35
    expect(rows[0].marginValue).toBeCloseTo((810 - 25.98) / 10 - 35);
    expect(rows[0].marginPercent).toBeCloseTo(rows[0].marginValue / 100);
  });

  it("calcula ACOS pela venda atribuída ao Ads e TACOS pela receita total", () => {
    const { rows } = buildProfitabilityReport(
      [soldA1()],
      new Map([["A1", cost()]]),
      0.3,
      new Map([["A1", 50]]),
      new Map(),
      new Map([["A1", 400]]),
    );
    expect(rows[0].adRevenue).toBe(400);
    expect(rows[0].acos).toBeCloseTo(50 / 400);
    expect(rows[0].tacos).toBeCloseTo(50 / 1000);
  });

  it("ACOS e TACOS ficam null sem investimento em Ads", () => {
    const { rows } = buildProfitabilityReport([soldA1()], new Map([["A1", cost()]]), 0.3);
    expect(rows[0].acos).toBeNull();
    expect(rows[0].tacos).toBeNull();
  });
});
