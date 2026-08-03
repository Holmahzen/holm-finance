import { describe, it, expect } from "vitest";
import {
  computeGrossMargin,
  computeCAC,
  computeAverageTicket,
  computeCashGeneration,
} from "@/domain/executiveDashboard";

describe("computeGrossMargin", () => {
  it("computes gross margin value and percent", () => {
    const result = computeGrossMargin(1000, 400);
    expect(result.value).toBe(600);
    expect(result.percent).toBeCloseTo(0.6);
  });

  it("returns null percent when there is no net revenue", () => {
    const result = computeGrossMargin(0, 100);
    expect(result.value).toBe(-100);
    expect(result.percent).toBeNull();
  });

  it("supports negative gross margin (COGS exceeds revenue)", () => {
    const result = computeGrossMargin(100, 150);
    expect(result.value).toBe(-50);
    expect(result.percent).toBeLessThan(0);
  });
});

describe("computeCAC", () => {
  it("divides ad spend by unique customers", () => {
    expect(computeCAC(1000, 20)).toBeCloseTo(50);
  });

  it("returns null when there are no customers", () => {
    expect(computeCAC(1000, 0)).toBeNull();
  });

  it("returns zero when there is no ad spend but there are customers", () => {
    expect(computeCAC(0, 10)).toBe(0);
  });
});

describe("computeAverageTicket", () => {
  it("divides gross revenue by sales count", () => {
    expect(computeAverageTicket(5000, 25)).toBe(200);
  });

  it("returns null when there are no sales", () => {
    expect(computeAverageTicket(5000, 0)).toBeNull();
  });
});

describe("computeCashGeneration", () => {
  it("returns inflow minus outflow", () => {
    expect(computeCashGeneration(10000, 7000)).toBe(3000);
  });

  it("can be negative when outflow exceeds inflow", () => {
    expect(computeCashGeneration(3000, 5000)).toBe(-2000);
  });
});
