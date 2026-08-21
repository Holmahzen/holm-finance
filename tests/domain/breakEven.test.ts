import { describe, it, expect } from "vitest";
import {
  computeProductMargin,
  computeSalesBasedMargin,
  computeBreakEven,
  computeEstimatedProfit,
  computeBreakEvenTargets,
} from "@/domain/breakEven";

describe("computeProductMargin", () => {
  it("computes variable cost, margin value and margin percent", () => {
    const result = computeProductMargin({
      salePrice: 100,
      tecidoCost: 20,
      costuraCost: 8,
      aviamentosCost: 2,
      marketplaceFee: 15,
      shippingCost: 10,
      packagingCost: 5,
      avgMonthlyQuantity: 20,
    });
    expect(result.variableCost).toBe(60);
    expect(result.marginValue).toBe(40);
    expect(result.marginPercent).toBe(0.4);
    expect(result.markupPercent).toBeCloseTo(40 / 60); // 0.6667
  });

  it("returns zero margin percent when sale price is zero", () => {
    const result = computeProductMargin({
      salePrice: 0,
      tecidoCost: 10,
      costuraCost: 0,
      aviamentosCost: 0,
      marketplaceFee: 0,
      shippingCost: 0,
      packagingCost: 0,
      avgMonthlyQuantity: 5,
    });
    expect(result.marginPercent).toBe(0);
    expect(result.markupPercent).toBeCloseTo(-10 / 10); // custo 10, sem preço pra cobrir
  });

  it("returns zero markup percent when variable cost is zero", () => {
    const result = computeProductMargin({
      salePrice: 100,
      tecidoCost: 0,
      costuraCost: 0,
      aviamentosCost: 0,
      marketplaceFee: 0,
      shippingCost: 0,
      packagingCost: 0,
      avgMonthlyQuantity: 5,
    });
    expect(result.markupPercent).toBe(0);
  });

  it("supports negative margin (cost exceeds price)", () => {
    const result = computeProductMargin({
      salePrice: 50,
      tecidoCost: 25,
      costuraCost: 10,
      aviamentosCost: 5,
      marketplaceFee: 15,
      shippingCost: 5,
      packagingCost: 2,
      avgMonthlyQuantity: 3,
    });
    expect(result.marginValue).toBeCloseTo(-12);
    expect(result.marginPercent).toBeLessThan(0);
    expect(result.markupPercent).toBeLessThan(0);
  });
});

describe("computeSalesBasedMargin", () => {
  it("subtracts the production cost per unit from the marketplace's net revenue", () => {
    // salePrice = 1000/10 = 100; netRevenue/unit = 800/10 = 80 (já líquido de comissão ML)
    // custo de produção = 20+8+2 = 30 por peça
    const result = computeSalesBasedMargin(
      { quantity: 10, grossRevenue: 1000, netRevenue: 800, marketplaceCost: 0 },
      { tecidoCost: 20, costuraCost: 8, aviamentosCost: 2 },
    );
    expect(result.marginValue).toBeCloseTo(50); // 80 - 30
    expect(result.marginPercent).toBeCloseTo(0.5); // 50/100
    expect(result.variableCost).toBeCloseTo(50); // 100 - 50
    expect(result.markupPercent).toBeCloseTo(1); // 50/50
  });

  it("adds the marketplace's own product-cost deduction back before subtracting our production cost, to avoid double-counting", () => {
    // O Mercado Turbo já descontou R$300 de "Custo (-)" pra chegar em
    // netRevenue=800 (de um faturamento de 1000). Precisamos somar esse
    // valor de volta antes de descontar nosso próprio custo de produção,
    // senão o custo é descontado duas vezes (uma pelo Mercado Turbo, com um
    // valor que pode estar desatualizado, outra pelo Holm Finance).
    // netRevenue + marketplaceCost = 800 + 300 = 1100 (base antes de QUALQUER custo de produto)
    // por unidade: 1100/10 = 110; custo de produção real = 20+8+2 = 30/un
    const result = computeSalesBasedMargin(
      { quantity: 10, grossRevenue: 1000, netRevenue: 800, marketplaceCost: 300 },
      { tecidoCost: 20, costuraCost: 8, aviamentosCost: 2 },
    );
    expect(result.marginValue).toBeCloseTo(80); // 110 - 30
  });

  it("falls back to the marketplace's net margin when there's no registered production cost", () => {
    const result = computeSalesBasedMargin(
      { quantity: 10, grossRevenue: 1000, netRevenue: 800, marketplaceCost: 0 },
      null,
    );
    expect(result.marginValue).toBeCloseTo(80);
    expect(result.marginPercent).toBeCloseTo(0.8);
  });

  it("can go negative when production cost exceeds the marketplace's net revenue", () => {
    const result = computeSalesBasedMargin(
      { quantity: 1, grossRevenue: 100, netRevenue: 70, marketplaceCost: 0 },
      { tecidoCost: 50, costuraCost: 20, aviamentosCost: 10 },
    );
    expect(result.marginValue).toBeCloseTo(-10); // 70 - 80
    expect(result.marginPercent).toBeLessThan(0);
  });

  it("returns zero margin when quantity is zero", () => {
    const result = computeSalesBasedMargin(
      { quantity: 0, grossRevenue: 0, netRevenue: 0, marketplaceCost: 0 },
      { tecidoCost: 10, costuraCost: 0, aviamentosCost: 0 },
    );
    expect(result.marginValue).toBe(0);
    expect(result.marginPercent).toBe(0);
  });
});

describe("computeBreakEven", () => {
  it("computes weighted break-even revenue and units from product mix", () => {
    const products = [
      { salePrice: 100, tecidoCost: 30, costuraCost: 0, aviamentosCost: 0, marketplaceFee: 15, shippingCost: 10, packagingCost: 5, avgMonthlyQuantity: 20, variableCost: 60, marginValue: 40, marginPercent: 0.4, markupPercent: 40 / 60 },
      { salePrice: 50, tecidoCost: 20, costuraCost: 0, aviamentosCost: 0, marketplaceFee: 8, shippingCost: 5, packagingCost: 2, avgMonthlyQuantity: 40, variableCost: 35, marginValue: 15, marginPercent: 0.3, markupPercent: 15 / 35 },
    ];
    // totalRevenue = 100*20 + 50*40 = 2000 + 2000 = 4000
    // totalContribution = 40*20 + 15*40 = 800 + 600 = 1400
    // totalVariableCost = 60*20 + 35*40 = 1200 + 1400 = 2600
    // weightedMarginPercent = 1400/4000 = 0.35
    // weightedMarkupPercent = 1400/2600 = 0.538461...
    const result = computeBreakEven(products, 3500);
    expect(result.totalRevenue).toBe(4000);
    expect(result.totalContribution).toBe(1400);
    expect(result.weightedMarginPercent).toBeCloseTo(0.35);
    expect(result.weightedMarkupPercent).toBeCloseTo(1400 / 2600);
    expect(result.breakEvenRevenue).toBeCloseTo(10000); // 3500 / 0.35
    expect(result.totalQty).toBe(60);
    expect(result.weightedAvgUnitMargin).toBeCloseTo(1400 / 60);
    expect(result.breakEvenUnits).toBeCloseTo(3500 / (1400 / 60));
  });

  it("returns null break-even figures when margin is zero or negative", () => {
    const products = [
      { salePrice: 50, tecidoCost: 40, costuraCost: 0, aviamentosCost: 0, marketplaceFee: 15, shippingCost: 5, packagingCost: 2, avgMonthlyQuantity: 10, variableCost: 62, marginValue: -12, marginPercent: -0.24, markupPercent: -12 / 62 },
    ];
    const result = computeBreakEven(products, 1000);
    expect(result.weightedMarginPercent).toBeLessThan(0);
    expect(result.weightedMarkupPercent).toBeLessThan(0);
    expect(result.breakEvenRevenue).toBeNull();
    expect(result.breakEvenUnits).toBeNull();
  });

  it("returns nulls when there is no revenue at all", () => {
    const result = computeBreakEven([], 1000);
    expect(result.weightedMarginPercent).toBeNull();
    expect(result.weightedMarkupPercent).toBeNull();
    expect(result.breakEvenRevenue).toBeNull();
    expect(result.weightedAvgUnitMargin).toBeNull();
    expect(result.breakEvenUnits).toBeNull();
  });
});

describe("computeEstimatedProfit", () => {
  it("returns profit (positive) when contribution from actual revenue exceeds fixed costs", () => {
    // revenue 10000 * margin 35% = 3500 contribution - 3000 fixed costs = 500 profit
    expect(computeEstimatedProfit(10000, 0.35, 3000)).toBeCloseTo(500);
  });

  it("returns loss (negative) when contribution doesn't cover fixed costs", () => {
    expect(computeEstimatedProfit(1000, 0.35, 3000)).toBeCloseTo(1000 * 0.35 - 3000);
  });

  it("returns null when there is no weighted margin percent to apply", () => {
    expect(computeEstimatedProfit(5000, null, 1000)).toBeNull();
  });
});

describe("computeBreakEvenTargets", () => {
  it("computes revenue and unit targets from an existing margin (simulator use case)", () => {
    const result = computeBreakEvenTargets(40000, 0.16151108486276577, 8.321948546927109);
    expect(result.breakEvenRevenue).toBeCloseTo(247661.02, 1);
    expect(result.breakEvenUnits).toBeCloseTo(4806.57, 1);
  });

  it("returns null revenue target when there is no positive margin percent", () => {
    expect(computeBreakEvenTargets(1000, null, 5).breakEvenRevenue).toBeNull();
    expect(computeBreakEvenTargets(1000, -0.1, 5).breakEvenRevenue).toBeNull();
    expect(computeBreakEvenTargets(1000, 0, 5).breakEvenRevenue).toBeNull();
  });

  it("returns null unit target when there is no positive avg unit margin", () => {
    expect(computeBreakEvenTargets(1000, 0.3, null).breakEvenUnits).toBeNull();
    expect(computeBreakEvenTargets(1000, 0.3, -2).breakEvenUnits).toBeNull();
  });
});
