import { describe, it, expect } from "vitest";
import { rankUncostedProducts } from "@/domain/productPriority";

function sku(overrides: Partial<Parameters<typeof rankUncostedProducts>[0][number]> = {}) {
  return { sku: "A", name: "Produto A", quantity: 1, grossRevenue: 100, netRevenue: 30, ...overrides };
}

describe("rankUncostedProducts", () => {
  it("excludes SKUs that already have cost registered", () => {
    const result = rankUncostedProducts(
      [sku({ sku: "A" }), sku({ sku: "B" })],
      new Set(["A"]),
    );
    expect(result.map((r) => r.sku)).toEqual(["B"]);
  });

  it("sorts uncosted SKUs by gross revenue, highest first", () => {
    const result = rankUncostedProducts(
      [
        sku({ sku: "A", grossRevenue: 100 }),
        sku({ sku: "B", grossRevenue: 500 }),
        sku({ sku: "C", grossRevenue: 300 }),
      ],
      new Set(),
    );
    expect(result.map((r) => r.sku)).toEqual(["B", "C", "A"]);
  });

  it("computes revenue share and cumulative share against the full sold-SKU total (costed + uncosted)", () => {
    const result = rankUncostedProducts(
      [
        sku({ sku: "A", grossRevenue: 600 }), // already costed
        sku({ sku: "B", grossRevenue: 300 }),
        sku({ sku: "C", grossRevenue: 100 }),
      ],
      new Set(["A"]),
    );
    // total = 1000, B=300 (30%), C=100 (10%)
    expect(result[0]).toMatchObject({ sku: "B", revenueShare: 0.3, cumulativeShare: 0.3 });
    expect(result[1]).toMatchObject({ sku: "C", revenueShare: 0.1, cumulativeShare: 0.4 });
  });

  it("returns an empty list when every SKU already has cost registered", () => {
    const result = rankUncostedProducts([sku({ sku: "A" }), sku({ sku: "B" })], new Set(["A", "B"]));
    expect(result).toEqual([]);
  });

  it("returns an empty list for no sales", () => {
    expect(rankUncostedProducts([], new Set())).toEqual([]);
  });
});
