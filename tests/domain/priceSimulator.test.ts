import { describe, it, expect } from "vitest";
import {
  breakdownAt,
  currentBreakdown,
  fixedCostPerUnit,
  markupOf,
  priceForMargin,
  quickMarginAt,
  quickPriceFor,
  type ModelEconomics,
} from "@/domain/priceSimulator";

// 100 peças a R$ 50: sobraram R$ 30/peça depois de imposto, tarifa e frete;
// custo de produção R$ 20; R$ 200 de Ads (4% da receita).
const model: ModelEconomics = { units: 100, grossRevenue: 5000, beforeProductionCost: 3000, adSpend: 200, unitCost: 20 };
const assumptions = { taxRate: 0.14, commissionRate: 0.14, includeAds: true };

describe("priceSimulator", () => {
  it("separa a parte fixa por peça do que a venda real descontou", () => {
    // descontos R$ 20/peça; percentuais 28% de R$ 50 = R$ 14; fixo = R$ 6
    expect(fixedCostPerUnit(model, assumptions)).toBeCloseTo(6);
  });

  it("no preço atual, reproduz a margem medida (sobra − custo − Ads)", () => {
    const b = currentBreakdown(model, assumptions);
    expect(b.contribution).toBeCloseTo(30 - 20 - 2);
    expect(b.marginPercent).toBeCloseTo(8 / 50);
  });

  it("acha o preço que leva à margem pedida", () => {
    const price = priceForMargin(model, assumptions, 0.18)!;
    expect(breakdownAt(model, assumptions, price).marginPercent).toBeCloseTo(0.18);
    // (6 + 20) / (1 − 0,14 − 0,14 − 0,04 − 0,18)
    expect(price).toBeCloseTo(26 / 0.5);
  });

  it("com imposto maior, pede preço maior", () => {
    const today = priceForMargin(model, assumptions, 0.18)!;
    const higherTax = priceForMargin(model, assumptions, 0.18, 0.2)!;
    expect(higherTax).toBeGreaterThan(today);
    expect(breakdownAt(model, assumptions, higherTax, 0.2).marginPercent).toBeCloseTo(0.18);
  });

  it("sem Ads, a margem não desconta o TACOS", () => {
    const b = currentBreakdown(model, { ...assumptions, includeAds: false });
    expect(b.ads).toBe(0);
    expect(b.marginPercent).toBeCloseTo(10 / 50);
  });

  it("devolve null quando nenhum preço chega na meta", () => {
    expect(priceForMargin(model, assumptions, 0.7)).toBeNull();
  });
});

describe("calculadora rápida", () => {
  const input = { unitCost: 20, fixedPerUnit: 6, taxRate: 0.14, commissionRate: 0.14, adsRate: 0.04 };

  it("preço pra margem pedida e markup equivalente", () => {
    const price = quickPriceFor(input, 0.18)!;
    expect(price).toBeCloseTo(26 / 0.5);
    expect(quickMarginAt(input, price).marginPercent).toBeCloseTo(0.18);
    expect(markupOf(price, 20)).toBeCloseTo(2.6);
  });

  it("margem a partir de um preço digitado", () => {
    // 50 × 0,68 − 6 − 20 = 8
    expect(quickMarginAt(input, 50)).toEqual({ contribution: expect.closeTo(8), marginPercent: expect.closeTo(0.16) });
  });

  it("sem custo não há markup, e meta impossível não tem preço", () => {
    expect(markupOf(50, 0)).toBeNull();
    expect(quickPriceFor(input, 0.7)).toBeNull();
  });
});

describe("parte fixa acima de R$ 79 informada pela usuária", () => {
  const withFixed = { ...assumptions, fixedAboveFreeShipping: 20 };

  it("só vale quando o preço testado cruza R$ 79", () => {
    expect(breakdownAt(model, withFixed, 60).fixedPerUnit).toBeCloseTo(6); // abaixo: segue a medida
    expect(breakdownAt(model, withFixed, 90).fixedPerUnit).toBeCloseTo(20); // acima: o valor informado
    expect(breakdownAt(model, assumptions, 90).fixedPerUnit).toBeCloseTo(6); // sem valor informado: mantém
  });

  it("não troca a parte fixa de quem já vende acima de R$ 79", () => {
    const expensive: ModelEconomics = { units: 10, grossRevenue: 1000, beforeProductionCost: 600, adSpend: 0, unitCost: 30 };
    expect(breakdownAt(expensive, withFixed, 120).fixedPerUnit).toBeCloseTo(fixedCostPerUnit(expensive, withFixed));
  });

  it("o preço pra margem alta usa a parte fixa de cima", () => {
    // sem a regra: 26 / 0,28 = 92,86; com R$ 20 fixos: (20 + 20) / 0,28 = 142,86
    expect(priceForMargin(model, withFixed, 0.4)!).toBeCloseTo(40 / 0.28);
    expect(priceForMargin(model, assumptions, 0.4)!).toBeCloseTo(26 / 0.28);
    // margem baixa fica abaixo de R$ 79: nada muda
    expect(priceForMargin(model, withFixed, 0.18)!).toBeCloseTo(52);
  });
});
