import { describe, it, expect } from "vitest";
import { latestEffectiveRate } from "@/domain/effectiveTaxRate";

const ap = (period: string, revenue: number, total: number) => ({ period, revenue, taxes: { total } });

describe("latestEffectiveRate", () => {
  it("usa o extrato mais recente (DAS ÷ receita do mês)", () => {
    const r = latestEffectiveRate([ap("2026-08", 481946.66, 63904.94), ap("2026-09", 430980.71, 62222.02)]);
    expect(r?.period).toBe("2026-09");
    expect(r?.rate).toBeCloseTo(0.1444, 3);
  });

  it("ignora extrato sem receita ou sem DAS", () => {
    const r = latestEffectiveRate([ap("2026-08", 481946.66, 63904.94), ap("2026-09", 0, 0)]);
    expect(r?.period).toBe("2026-08");
  });

  it("devolve null sem nenhum extrato", () => {
    expect(latestEffectiveRate([])).toBeNull();
  });
});
