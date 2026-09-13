import { describe, it, expect } from "vitest";
import { pickMonthlyRevenues } from "@/domain/simplesNacional";

describe("pickMonthlyRevenues com o PGDAS-D", () => {
  const months = [
    { year: 2026, month: 7 },
    { year: 2026, month: 8 },
    { year: 2026, month: 9 },
  ];

  it("usa o faturamento declarado no PGDAS antes das notas e da DRE", () => {
    const result = pickMonthlyRevenues(
      months,
      {
        "2026-08": { netSales: 100, saleNotes: 5 }, // notas incompletas do mês
        "2026-09": { netSales: 153_985.19, saleNotes: 2529 },
      },
      { "2026-07": 194_775, "2026-09": 90_000 },
      { "2026-07": 384_688.41, "2026-08": 481_946.66 },
    );
    expect(result).toEqual([
      { year: 2026, month: 7, revenue: 384_688.41, source: "pgdas" },
      { year: 2026, month: 8, revenue: 481_946.66, source: "pgdas" },
      { year: 2026, month: 9, revenue: 153_985.19, source: "notas" },
    ]);
  });

  it("aceita faturamento zero declarado, sem cair para as notas", () => {
    const [julho] = pickMonthlyRevenues(
      [{ year: 2026, month: 7 }],
      { "2026-07": { netSales: 500, saleNotes: 3 } },
      {},
      { "2026-07": 0 },
    );
    expect(julho).toEqual({ year: 2026, month: 7, revenue: 0, source: "pgdas" });
  });
});
