import { describe, it, expect } from "vitest";
import { computeTrailingMonths, computeSimplesNacionalStatus } from "@/domain/simplesNacional";

describe("computeTrailingMonths", () => {
  it("returns the 12 months ending at the given month, crossing the year boundary", () => {
    const months = computeTrailingMonths(2026, 9, 12);
    expect(months[0]).toEqual({ year: 2025, month: 10 });
    expect(months[months.length - 1]).toEqual({ year: 2026, month: 9 });
    expect(months).toHaveLength(12);
  });

  it("stays within the same year when the window doesn't cross a boundary", () => {
    const months = computeTrailingMonths(2026, 6, 3);
    expect(months).toEqual([
      { year: 2026, month: 4 },
      { year: 2026, month: 5 },
      { year: 2026, month: 6 },
    ]);
  });
});

describe("computeSimplesNacionalStatus", () => {
  const ceiling = 4_800_000;

  it("sums all 12 months for RBT12 and only the current-year ones for year-to-date", () => {
    const monthlyRevenues = [
      { year: 2025, month: 10, revenue: 100_000 },
      { year: 2025, month: 11, revenue: 100_000 },
      { year: 2025, month: 12, revenue: 100_000 },
      { year: 2026, month: 1, revenue: 50_000 },
      { year: 2026, month: 2, revenue: 50_000 },
      { year: 2026, month: 3, revenue: 50_000 },
      { year: 2026, month: 4, revenue: 50_000 },
      { year: 2026, month: 5, revenue: 50_000 },
      { year: 2026, month: 6, revenue: 50_000 },
      { year: 2026, month: 7, revenue: 50_000 },
      { year: 2026, month: 8, revenue: 50_000 },
      { year: 2026, month: 9, revenue: 50_000 },
    ];
    const status = computeSimplesNacionalStatus(monthlyRevenues, 2026, 9, ceiling);
    expect(status.rbt12).toBe(750_000);
    expect(status.yearToDate).toBe(450_000);
    expect(status.rbt12PercentOfCeiling).toBeCloseTo((750_000 / ceiling) * 100);
  });

  it("projects year-end from the average of the last 3 closed months", () => {
    const monthlyRevenues = computeTrailingMonths(2026, 3, 12).map(({ year, month }) => ({
      year,
      month,
      // Só os 3 meses fechados antes de março/2026 têm receita; o resto é 0.
      revenue: year === 2026 && month === 1 ? 300_000 : year === 2025 && month === 12 ? 300_000 : year === 2025 && month === 11 ? 300_000 : year === 2026 && month === 2 ? 200_000 : 0,
    }));
    // Meses fechados antes do corrente (março/2026): nov/25, dez/25, jan/26, fev/26 -> últimos 3 = dez/25, jan/26, fev/26
    const status = computeSimplesNacionalStatus(monthlyRevenues, 2026, 3, ceiling);
    // média dos últimos 3 fechados (dez=300k, jan=300k, fev=200k) = 266.666,67 * 9 meses restantes + YTD (jan+fev=500k)
    const avg = (300_000 + 300_000 + 200_000) / 3;
    const expectedProjection = 500_000 + avg * 9;
    expect(status.projectedYearEnd).toBeCloseTo(expectedProjection);
  });

  it("returns null projection when the input has no closed month at all", () => {
    // Caso defensivo: só o mês corrente foi passado, sem nenhum mês anterior
    // pra estimar ritmo (não deveria acontecer com computeTrailingMonths,
    // mas a função não deve quebrar se receber isso).
    const status = computeSimplesNacionalStatus([{ year: 2026, month: 1, revenue: 100_000 }], 2026, 1, ceiling);
    expect(status.projectedYearEnd).toBeNull();
  });

  it("flags critico at or above 95% of the ceiling", () => {
    const monthlyRevenues = [{ year: 2026, month: 9, revenue: ceiling * 0.96 }];
    const status = computeSimplesNacionalStatus(monthlyRevenues, 2026, 9, ceiling);
    expect(status.alertLevel).toBe("critico");
  });

  it("flags atencao between 80% and 95% of the ceiling", () => {
    const monthlyRevenues = [{ year: 2026, month: 9, revenue: ceiling * 0.85 }];
    const status = computeSimplesNacionalStatus(monthlyRevenues, 2026, 9, ceiling);
    expect(status.alertLevel).toBe("atencao");
  });

  it("flags ok below 80% of the ceiling", () => {
    const monthlyRevenues = [{ year: 2026, month: 9, revenue: ceiling * 0.5 }];
    const status = computeSimplesNacionalStatus(monthlyRevenues, 2026, 9, ceiling);
    expect(status.alertLevel).toBe("ok");
  });
});
