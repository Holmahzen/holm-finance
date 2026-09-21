import { describe, it, expect } from "vitest";
import { summarizeGeneralStorageByMonth } from "@/domain/mlFullCostSummary";

describe("summarizeGeneralStorageByMonth", () => {
  it("agrupa por ano-mes e soma valor/quantidade", () => {
    const rows = [
      { costDate: new Date(Date.UTC(2026, 7, 5)), amount: 10 },
      { costDate: new Date(Date.UTC(2026, 7, 20)), amount: 5 },
      { costDate: new Date(Date.UTC(2026, 8, 1)), amount: 20 },
    ];
    const result = summarizeGeneralStorageByMonth(rows);
    expect(result).toEqual([
      { month: "2026-08", total: 15, count: 2 },
      { month: "2026-09", total: 20, count: 1 },
    ]);
  });

  it("ordena os meses cronologicamente mesmo fora de ordem na entrada", () => {
    const rows = [
      { costDate: new Date(Date.UTC(2026, 8, 1)), amount: 1 },
      { costDate: new Date(Date.UTC(2026, 0, 1)), amount: 2 },
      { costDate: new Date(Date.UTC(2025, 11, 1)), amount: 3 },
    ];
    const result = summarizeGeneralStorageByMonth(rows);
    expect(result.map((r) => r.month)).toEqual(["2025-12", "2026-01", "2026-09"]);
  });

  it("volta lista vazia pra entrada vazia", () => {
    expect(summarizeGeneralStorageByMonth([])).toEqual([]);
  });
});
