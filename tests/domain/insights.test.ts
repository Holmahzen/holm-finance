import { describe, it, expect } from "vitest";
import { computeInsights, type InsightsInput } from "@/domain/insights";

function baseInput(overrides: Partial<InsightsInput> = {}): InsightsInput {
  return {
    weightedMarginPercent: 0.35,
    marginAlertThreshold: 20,
    breakEvenRevenue: 10000,
    progress: 5000,
    estimatedProfit: 1000,
    negativeMarginProducts: [],
    projection: null,
    projectedBreakEvenDay: null,
    ...overrides,
  };
}

describe("computeInsights", () => {
  it("flags margin below the alert threshold as critical", () => {
    const insights = computeInsights(baseInput({ weightedMarginPercent: 0.1, marginAlertThreshold: 20 }));
    expect(insights[0]).toMatchObject({ type: "margin_below_threshold", severity: "critical" });
  });

  it("flags products with negative margin as critical", () => {
    const insights = computeInsights(
      baseInput({ negativeMarginProducts: [{ name: "A" }, { name: "B" }] }),
    );
    const found = insights.find((i) => i.type === "negative_margin_products");
    expect(found).toMatchObject({ severity: "critical", count: 2, sampleNames: ["A", "B"] });
  });

  it("truncates the sample name list to 3 while keeping the full count", () => {
    const insights = computeInsights(
      baseInput({
        negativeMarginProducts: [{ name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }],
      }),
    );
    const found = insights.find((i) => i.type === "negative_margin_products");
    expect(found).toMatchObject({ count: 4, sampleNames: ["A", "B", "C"] });
  });

  it("flags negative estimated profit as warning", () => {
    const insights = computeInsights(baseInput({ estimatedProfit: -500 }));
    expect(insights.some((i) => i.type === "negative_estimated_profit" && i.severity === "warning")).toBe(
      true,
    );
  });

  it("reports break-even already reached when progress is non-negative", () => {
    const insights = computeInsights(baseInput({ progress: 2000 }));
    expect(insights.find((i) => i.type === "break_even_reached")).toMatchObject({ surplus: 2000 });
  });

  it("reports projection below break-even as warning when behind pace", () => {
    const insights = computeInsights(
      baseInput({ progress: -3000, projection: { projectedRevenue: 8000 } }),
    );
    expect(insights.find((i) => i.type === "projection_below_break_even")).toMatchObject({
      severity: "warning",
      projectedRevenue: 8000,
      breakEvenRevenue: 10000,
    });
  });

  it("reports projection above break-even as info when pace catches up", () => {
    const insights = computeInsights(
      baseInput({ progress: -3000, projection: { projectedRevenue: 15000 } }),
    );
    expect(insights.find((i) => i.type === "projection_above_break_even")).toMatchObject({
      severity: "info",
      projectedRevenue: 15000,
    });
  });

  it("includes the projected break-even day when provided", () => {
    const insights = computeInsights(baseInput({ progress: -3000, projectedBreakEvenDay: 18 }));
    expect(insights.find((i) => i.type === "projected_break_even_day")).toMatchObject({ day: 18 });
  });

  it("orders insights by severity: critical, then warning, then info", () => {
    const insights = computeInsights(
      baseInput({
        weightedMarginPercent: 0.1,
        marginAlertThreshold: 20,
        estimatedProfit: -500,
        progress: 2000,
      }),
    );
    const severities = insights.map((i) => i.severity);
    const ranks: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    for (let i = 1; i < severities.length; i++) {
      expect(ranks[severities[i]]).toBeGreaterThanOrEqual(ranks[severities[i - 1]]);
    }
  });

  it("returns no insights when everything is healthy and break-even already met", () => {
    const insights = computeInsights(
      baseInput({ weightedMarginPercent: 0.4, marginAlertThreshold: 10, estimatedProfit: 5000, progress: 100 }),
    );
    expect(insights).toHaveLength(1);
    expect(insights[0].type).toBe("break_even_reached");
  });
});
