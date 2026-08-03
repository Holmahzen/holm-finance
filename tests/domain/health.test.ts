import { describe, it, expect } from "vitest";
import { computeHealthSignals, type HealthMonth } from "@/domain/health";

function month(overrides: Partial<HealthMonth> = {}): HealthMonth {
  return {
    year: 2026,
    month: 1,
    receitaLiquida: 10000,
    despesasFixas: 3000,
    despesasFixasByCategory: [],
    margemContribuicaoPercent: 30,
    lucroLiquido: 1000,
    saldoConta: 5000,
    ...overrides,
  };
}

describe("computeHealthSignals", () => {
  it("flags a revenue decline streak across 3 consecutive months", () => {
    const series = [
      month({ month: 1, receitaLiquida: 30000 }),
      month({ month: 2, receitaLiquida: 20000 }),
      month({ month: 3, receitaLiquida: 10000 }),
    ];
    const signals = computeHealthSignals(series);
    expect(signals).toContainEqual({ type: "revenue_declining", severity: "warning", months: 3 });
  });

  it("flags revenue growth across consecutive months", () => {
    const series = [
      month({ month: 1, receitaLiquida: 10000 }),
      month({ month: 2, receitaLiquida: 20000 }),
      month({ month: 3, receitaLiquida: 30000 }),
    ];
    const signals = computeHealthSignals(series);
    expect(signals).toContainEqual({ type: "revenue_growing", severity: "info", months: 3 });
  });

  it("flags a critical loss streak of 2+ trailing months", () => {
    const series = [
      month({ month: 1, lucroLiquido: 1000 }),
      month({ month: 2, lucroLiquido: -500 }),
      month({ month: 3, lucroLiquido: -800 }),
    ];
    const signals = computeHealthSignals(series);
    expect(signals).toContainEqual({ type: "loss_streak", severity: "critical", months: 2 });
  });

  it("flags a single trailing loss month as a lighter warning", () => {
    const series = [
      month({ month: 1, lucroLiquido: 1000 }),
      month({ month: 2, lucroLiquido: 900 }),
      month({ month: 3, lucroLiquido: -200 }),
    ];
    const signals = computeHealthSignals(series);
    expect(signals).toContainEqual({ type: "loss_streak", severity: "warning", months: 1 });
  });

  it("flags a profit streak of 3+ months when there's no loss", () => {
    const series = [
      month({ month: 1, lucroLiquido: 500 }),
      month({ month: 2, lucroLiquido: 600 }),
      month({ month: 3, lucroLiquido: 700 }),
    ];
    const signals = computeHealthSignals(series);
    expect(signals).toContainEqual({ type: "profit_streak", severity: "info", months: 3 });
  });

  it("flags declining contribution margin comparing two 3-month windows", () => {
    const series = [
      month({ month: 1, margemContribuicaoPercent: 40 }),
      month({ month: 2, margemContribuicaoPercent: 40 }),
      month({ month: 3, margemContribuicaoPercent: 40 }),
      month({ month: 4, margemContribuicaoPercent: 20 }),
      month({ month: 5, margemContribuicaoPercent: 20 }),
      month({ month: 6, margemContribuicaoPercent: 20 }),
    ];
    const signals = computeHealthSignals(series);
    const found = signals.find((s) => s.type === "margin_declining");
    expect(found).toMatchObject({ severity: "warning", fromPercent: 40, toPercent: 20 });
  });

  it("flags fixed costs growing faster than revenue", () => {
    const series = [
      month({ month: 1, receitaLiquida: 10000, despesasFixas: 1000 }),
      month({ month: 2, receitaLiquida: 10500, despesasFixas: 3000 }),
    ];
    const signals = computeHealthSignals(series);
    const found = signals.find((s) => s.type === "fixed_costs_outpacing_revenue");
    expect(found).toBeDefined();
    expect(found).toMatchObject({ severity: "warning", fixedCostsDelta: 2000, revenueDelta: 500 });
  });

  it("names the categories most responsible for the fixed cost increase, biggest delta first", () => {
    const series = [
      month({
        month: 1,
        receitaLiquida: 10000,
        despesasFixas: 5000,
        despesasFixasByCategory: [
          { categoryId: "folha", name: "Folha", total: 3000 },
          { categoryId: "aluguel", name: "Aluguel", total: 1500 },
          { categoryId: "internet", name: "Internet", total: 200 },
        ],
      }),
      month({
        month: 2,
        receitaLiquida: 6200, // caiu 38%
        despesasFixas: 7318,
        despesasFixasByCategory: [
          { categoryId: "folha", name: "Folha", total: 4450 }, // +1450
          { categoryId: "aluguel", name: "Aluguel", total: 2000 }, // +500
          { categoryId: "internet", name: "Internet", total: 380 }, // +180
        ],
      }),
    ];
    const signals = computeHealthSignals(series);
    const found = signals.find((s) => s.type === "fixed_costs_outpacing_revenue");
    expect(found).toMatchObject({
      fixedCostsDelta: 2318,
      topCategories: [
        { name: "Folha", delta: 1450 },
        { name: "Aluguel", delta: 500 },
        { name: "Internet", delta: 180 },
      ],
    });
  });

  it("excludes categories that shrank or stayed flat from the top-growing list", () => {
    const series = [
      month({
        month: 1,
        receitaLiquida: 10000,
        despesasFixas: 2000,
        despesasFixasByCategory: [
          { categoryId: "folha", name: "Folha", total: 1000 },
          { categoryId: "marketing", name: "Marketing", total: 1000 },
        ],
      }),
      month({
        month: 2,
        receitaLiquida: 10100,
        despesasFixas: 2500,
        despesasFixasByCategory: [
          { categoryId: "folha", name: "Folha", total: 1500 }, // +500
          { categoryId: "marketing", name: "Marketing", total: 1000 }, // unchanged
        ],
      }),
    ];
    const signals = computeHealthSignals(series);
    const found = signals.find((s) => s.type === "fixed_costs_outpacing_revenue");
    expect(found?.topCategories).toEqual([{ name: "Folha", delta: 500 }]);
  });

  it("flags cash balance declining across consecutive months", () => {
    const series = [
      month({ month: 1, saldoConta: 30000 }),
      month({ month: 2, saldoConta: 20000 }),
      month({ month: 3, saldoConta: 10000 }),
    ];
    const signals = computeHealthSignals(series);
    expect(signals).toContainEqual({ type: "cash_declining", severity: "warning", months: 3 });
  });

  it("ignores months with no activity at all (future/empty months)", () => {
    const series = [
      month({ month: 1, receitaLiquida: 10000, despesasFixas: 1000, lucroLiquido: 500 }),
      month({ month: 2, receitaLiquida: 0, despesasFixas: 0, lucroLiquido: 0, margemContribuicaoPercent: null }),
      month({ month: 3, receitaLiquida: 0, despesasFixas: 0, lucroLiquido: 0, margemContribuicaoPercent: null }),
    ];
    const signals = computeHealthSignals(series);
    expect(signals.find((s) => s.type === "revenue_declining")).toBeUndefined();
  });

  it("orders signals by severity: critical, then warning, then info", () => {
    const series = [
      month({ month: 1, receitaLiquida: 30000, lucroLiquido: -100, saldoConta: 30000 }),
      month({ month: 2, receitaLiquida: 20000, lucroLiquido: -200, saldoConta: 20000 }),
      month({ month: 3, receitaLiquida: 10000, lucroLiquido: -300, saldoConta: 10000 }),
    ];
    const signals = computeHealthSignals(series);
    const ranks: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    for (let i = 1; i < signals.length; i++) {
      expect(ranks[signals[i].severity]).toBeGreaterThanOrEqual(ranks[signals[i - 1].severity]);
    }
  });

  it("returns no signals for a flat, empty series", () => {
    const signals = computeHealthSignals([]);
    expect(signals).toEqual([]);
  });
});
