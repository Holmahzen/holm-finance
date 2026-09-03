import { describe, it, expect } from "vitest";
import { aggregateSalesBySku, isExcludedSaleStatus, computeRevenueInTransit } from "@/domain/salesAggregation";

const utcDay = (day: number) => new Date(Date.UTC(2026, 7, day));

function sale(overrides: Partial<Parameters<typeof aggregateSalesBySku>[0][number]> = {}) {
  return {
    sku: "SKU-1",
    productName: "Produto 1",
    quantity: 1,
    grossRevenue: 100,
    netRevenue: 30,
    marketplaceCost: 10,
    status: "Pago",
    ...overrides,
  };
}

describe("aggregateSalesBySku", () => {
  it("sums quantity, gross and net revenue for repeated SKUs", () => {
    const result = aggregateSalesBySku([
      sale({ sku: "SKU-1", quantity: 1, grossRevenue: 100, netRevenue: 30, marketplaceCost: 10 }),
      sale({ sku: "SKU-1", quantity: 2, grossRevenue: 180, netRevenue: 50, marketplaceCost: 15 }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      sku: "SKU-1",
      quantity: 3,
      grossRevenue: 280,
      netRevenue: 80,
      marketplaceCost: 25,
    });
  });

  it("keeps different SKUs as separate entries", () => {
    const result = aggregateSalesBySku([sale({ sku: "A" }), sale({ sku: "B" })]);
    expect(result.map((r) => r.sku).sort()).toEqual(["A", "B"]);
  });

  it("excludes cancelled orders by default", () => {
    const result = aggregateSalesBySku([
      sale({ sku: "SKU-1", quantity: 1, grossRevenue: 100, netRevenue: 30, status: "Pago" }),
      sale({ sku: "SKU-1", quantity: 5, grossRevenue: 500, netRevenue: 150, status: "Cancelado" }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ quantity: 1, grossRevenue: 100, netRevenue: 30 });
  });

  it("is case/whitespace-insensitive when matching excluded statuses", () => {
    const result = aggregateSalesBySku([sale({ status: "  cancelado  " })]);
    expect(result).toHaveLength(0);
  });

  it("excludes partial returns by default", () => {
    const result = aggregateSalesBySku([
      sale({ sku: "SKU-1", quantity: 1, grossRevenue: 100, netRevenue: 30, status: "Pago" }),
      sale({ sku: "SKU-1", quantity: 1, grossRevenue: 90, netRevenue: 20, status: "Devolução Parcial" }),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ quantity: 1, grossRevenue: 100, netRevenue: 30 });
  });

  it("accepts a custom excluded-status list", () => {
    const result = aggregateSalesBySku(
      [sale({ status: "Devolvido" }), sale({ status: "Pago" })],
      ["devolvido"],
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ quantity: 1 });
  });

  it("returns an empty array for no sales", () => {
    expect(aggregateSalesBySku([])).toEqual([]);
  });

  it("uses the product name from the first occurrence of a SKU", () => {
    const result = aggregateSalesBySku([
      sale({ sku: "SKU-1", productName: "Nome Original" }),
      sale({ sku: "SKU-1", productName: "Nome Diferente" }),
    ]);
    expect(result[0].name).toBe("Nome Original");
  });
});

describe("isExcludedSaleStatus", () => {
  it("flags cancelled and partially-returned orders by default", () => {
    expect(isExcludedSaleStatus("Cancelado")).toBe(true);
    expect(isExcludedSaleStatus("Devolução Parcial")).toBe(true);
    expect(isExcludedSaleStatus("Pago")).toBe(false);
  });

  it("is case/whitespace-insensitive", () => {
    expect(isExcludedSaleStatus("  DEVOLUÇÃO PARCIAL  ")).toBe(true);
  });

  it("accepts a custom excluded-status list", () => {
    expect(isExcludedSaleStatus("Devolvido", ["devolvido"])).toBe(true);
    expect(isExcludedSaleStatus("Cancelado", ["devolvido"])).toBe(false);
  });
});

describe("computeRevenueInTransit", () => {
  it("sums only sales from the cutoff day onward", () => {
    const result = computeRevenueInTransit(
      [
        { saleDate: utcDay(10), grossRevenue: 100, netRevenue: 30, status: "Pago" },
        { saleDate: utcDay(20), grossRevenue: 200, netRevenue: 50, status: "Pago" },
        { saleDate: utcDay(25), grossRevenue: 300, netRevenue: 70, status: "Pago" },
      ],
      20,
    );
    expect(result).toEqual({ fromDay: 20, salesCount: 2, grossRevenue: 500, netRevenue: 120 });
  });

  it("excludes cancelled/returned sales even within the cutoff window", () => {
    const result = computeRevenueInTransit(
      [
        { saleDate: utcDay(22), grossRevenue: 200, netRevenue: 50, status: "Pago" },
        { saleDate: utcDay(25), grossRevenue: 300, netRevenue: 70, status: "Cancelado" },
      ],
      20,
    );
    expect(result).toEqual({ fromDay: 20, salesCount: 1, grossRevenue: 200, netRevenue: 50 });
  });

  it("returns zeros when nothing falls on or after the cutoff day", () => {
    const result = computeRevenueInTransit(
      [{ saleDate: utcDay(5), grossRevenue: 100, netRevenue: 30, status: "Pago" }],
      20,
    );
    expect(result).toEqual({ fromDay: 20, salesCount: 0, grossRevenue: 0, netRevenue: 0 });
  });
});
