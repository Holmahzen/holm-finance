import { describe, it, expect } from "vitest";
import {
  classifyAbc,
  classifyQuadrant,
  suggestMarginThreshold,
  buildProfitabilityReport,
  type SkuAbc,
} from "@/domain/productProfitability";
import type { SkuSalesAggregate } from "@/domain/salesAggregation";
import type { ProductInput } from "@/domain/breakEven";

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

function product(overrides: Partial<ProductInput> = {}): ProductInput {
  return {
    salePrice: 100,
    tecidoCost: 20,
    costuraCost: 10,
    aviamentosCost: 5,
    marketplaceFee: 19,
    shippingCost: 0,
    packagingCost: 0,
    avgMonthlyQuantity: 0,
    ...overrides,
  };
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
    const skus = [sku({ sku: "A1", grossRevenue: 1000, quantity: 10 })];
    const products = new Map([["A1", product({ salePrice: 100, tecidoCost: 20, costuraCost: 10, aviamentosCost: 5, marketplaceFee: 19 })]]);
    const { rows } = buildProfitabilityReport(skus, products, 0.3);
    expect(rows).toHaveLength(1);
    expect(rows[0].hasCost).toBe(true);
    expect(rows[0].marginValue).toBeCloseTo(46); // 100 - (20+10+5+19)
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
    const skus: SkuSalesAggregate[] = [sku({ sku: "A1", grossRevenue: 600 }), sku({ sku: "A2", grossRevenue: 400 })];
    const products = new Map([
      ["A1", product({ salePrice: 100, tecidoCost: 0, costuraCost: 0, aviamentosCost: 0, marketplaceFee: 20 })], // margem 80%
      ["A2", product({ salePrice: 100, tecidoCost: 60, costuraCost: 0, aviamentosCost: 0, marketplaceFee: 20 })], // margem 20%
    ]);
    const { suggestedMarginThreshold } = buildProfitabilityReport(skus, products);
    expect(suggestedMarginThreshold).toBeCloseTo(0.5); // mediana entre 0.8 e 0.2
  });

  it("classifyAbc puro continua acessivel (exportado) pra reuso", () => {
    const result: SkuAbc[] = classifyAbc([sku()]);
    expect(result[0].tier).toBe("A");
  });

  it("desconta o investimento em Ads da contribuicao quando o SKU tem gasto no periodo", () => {
    const skus = [sku({ sku: "A1", grossRevenue: 1000, quantity: 10 })];
    const products = new Map([["A1", product({ salePrice: 100, tecidoCost: 20, costuraCost: 10, aviamentosCost: 5, marketplaceFee: 19 })]]);
    const adSpendBySku = new Map([["A1", 150]]);
    const { rows } = buildProfitabilityReport(skus, products, 0.3, adSpendBySku);
    expect(rows[0].contribution).toBeCloseTo(460); // 46 * 10, sem desconto de Ads
    expect(rows[0].adSpend).toBe(150);
    expect(rows[0].contributionAfterAds).toBeCloseTo(310); // 460 - 150
  });

  it("adSpend e contributionAfterAds ficam zero/iguais a contribution quando nao ha gasto de Ads pro SKU", () => {
    const skus = [sku({ sku: "A1", grossRevenue: 1000, quantity: 10 })];
    const products = new Map([["A1", product({ salePrice: 100, tecidoCost: 20, costuraCost: 10, aviamentosCost: 5, marketplaceFee: 19 })]]);
    const { rows } = buildProfitabilityReport(skus, products, 0.3);
    expect(rows[0].adSpend).toBe(0);
    expect(rows[0].contributionAfterAds).toBeCloseTo(rows[0].contribution);
  });
});
