import { describe, it, expect } from "vitest";
import { computeRevenueProfitProjection } from "@/domain/companyProjection";

describe("computeRevenueProfitProjection", () => {
  it("projects revenue, target and profit over N days from daily paces", () => {
    // ritmo 1000/dia de faturamento, margem 20%, custo fixo 150/dia, meta 900/dia -> 90 dias
    const result = computeRevenueProfitProjection({
      days: 90,
      dailyRevenuePace: 1000,
      weightedMarginPercent: 0.2,
      dailyFixedCost: 150,
      dailyTargetPace: 900,
    });

    expect(result.projectedRevenue).toBeCloseTo(90000);
    expect(result.targetRevenue).toBeCloseTo(81000);
    expect(result.progressVsTarget).toBeCloseTo(9000);
    // lucro/dia = 1000*0.2 - 150 = 50 -> 90 dias = 4500
    expect(result.dailyProfitPace).toBeCloseTo(50);
    expect(result.projectedProfit).toBeCloseTo(4500);
  });

  it("returns null profit/target fields when margin or target pace are unknown", () => {
    const result = computeRevenueProfitProjection({
      days: 30,
      dailyRevenuePace: 500,
      weightedMarginPercent: null,
      dailyFixedCost: 100,
      dailyTargetPace: null,
    });

    expect(result.projectedRevenue).toBeCloseTo(15000);
    expect(result.targetRevenue).toBeNull();
    expect(result.progressVsTarget).toBeNull();
    expect(result.dailyProfitPace).toBeNull();
    expect(result.projectedProfit).toBeNull();
  });

  it("supports a negative daily profit pace (custo fixo maior que a contribuição)", () => {
    const result = computeRevenueProfitProjection({
      days: 30,
      dailyRevenuePace: 100,
      weightedMarginPercent: 0.1,
      dailyFixedCost: 50,
      dailyTargetPace: null,
    });

    // lucro/dia = 100*0.1 - 50 = -40
    expect(result.dailyProfitPace).toBeCloseTo(-40);
    expect(result.projectedProfit).toBeCloseTo(-1200);
  });
});
