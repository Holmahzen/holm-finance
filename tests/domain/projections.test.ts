import { describe, it, expect } from "vitest";
import {
  computeMonthRevenueProjection,
  computeMonthRevenueProjectionWithFallback,
  computeProjectedBreakEvenDay,
} from "@/domain/projections";

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

describe("computeMonthRevenueProjectionWithFallback", () => {
  it("nos primeiros dias usa o ritmo de referência pros dias que faltam", () => {
    // dia 2 de outubro: R$ 30 mil faturados, ritmo dos últimos 30 dias R$ 15 mil/dia
    const p = computeMonthRevenueProjectionWithFallback(30_000, 2, 31, 15_000);
    expect(p?.dailyPace).toBe(15_000);
    expect(p?.projectedRevenue).toBe(30_000 + 15_000 * 29);
  });

  it("a partir do 7º dia usa o ritmo do próprio mês", () => {
    const p = computeMonthRevenueProjectionWithFallback(70_000, 7, 30, 15_000);
    expect(p).toEqual(computeMonthRevenueProjection(70_000, 7, 30));
  });

  it("sem ritmo de referência cai na projeção do próprio mês", () => {
    expect(computeMonthRevenueProjectionWithFallback(30_000, 2, 31, null)).toEqual(
      computeMonthRevenueProjection(30_000, 2, 31),
    );
  });
});
