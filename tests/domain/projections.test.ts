import { describe, it, expect } from "vitest";
import { computeMonthRevenueProjection, computeProjectedBreakEvenDay } from "@/domain/projections";

describe("computeMonthRevenueProjection", () => {
  it("projects month-end revenue from the daily pace so far", () => {
    // 10000 faturado em 10 dias, mês com 30 dias -> ritmo 1000/dia -> projeta 30000
    const result = computeMonthRevenueProjection(10000, 10, 30);
    expect(result).not.toBeNull();
    expect(result?.dailyPace).toBeCloseTo(1000);
    expect(result?.projectedRevenue).toBeCloseTo(30000);
  });

  it("returns null when no days have elapsed yet", () => {
    expect(computeMonthRevenueProjection(0, 0, 30)).toBeNull();
  });
});

describe("computeProjectedBreakEvenDay", () => {
  it("computes the day of month the break-even should be reached", () => {
    // meta 5000, ritmo 500/dia -> dia 10
    expect(computeProjectedBreakEvenDay(5000, 500, 30)).toBe(10);
  });

  it("returns null when the pace never reaches the target within the month", () => {
    // meta 100000, ritmo 500/dia, mês 30 dias -> precisaria de 200 dias
    expect(computeProjectedBreakEvenDay(100000, 500, 30)).toBeNull();
  });

  it("returns null when there is no positive pace or no break-even target", () => {
    expect(computeProjectedBreakEvenDay(null, 500, 30)).toBeNull();
    expect(computeProjectedBreakEvenDay(5000, 0, 30)).toBeNull();
    expect(computeProjectedBreakEvenDay(5000, -10, 30)).toBeNull();
  });
});
