import { describe, it, expect } from "vitest";
import { computeCogsBySku } from "@/domain/cogs";

describe("computeCogsBySku", () => {
  it("multiplies quantity sold by per-piece cost for matched SKUs", () => {
    const result = computeCogsBySku(
      [{ sku: "A", quantity: 10 }],
      [{ sku: "A", tecidoCost: 5, costuraCost: 3, aviamentosCost: 1 }],
    );
    expect(result.tecido).toBe(50);
    expect(result.costura).toBe(30);
    expect(result.aviamentos).toBe(10);
    expect(result.matchedSkus).toBe(1);
    expect(result.unmatchedSkus).toBe(0);
  });

  it("sums across multiple matched SKUs", () => {
    const result = computeCogsBySku(
      [
        { sku: "A", quantity: 10 },
        { sku: "B", quantity: 4 },
      ],
      [
        { sku: "A", tecidoCost: 5, costuraCost: 3, aviamentosCost: 1 },
        { sku: "B", tecidoCost: 2, costuraCost: 1, aviamentosCost: 0.5 },
      ],
    );
    expect(result.tecido).toBe(58); // 5*10 + 2*4
    expect(result.costura).toBe(34); // 3*10 + 1*4
    expect(result.aviamentos).toBe(12); // 1*10 + 0.5*4
    expect(result.matchedSkus).toBe(2);
  });

  it("counts SKUs with no matching product as unmatched, without contributing cost", () => {
    const result = computeCogsBySku(
      [
        { sku: "A", quantity: 10 },
        { sku: "UNKNOWN", quantity: 5 },
      ],
      [{ sku: "A", tecidoCost: 5, costuraCost: 3, aviamentosCost: 1 }],
    );
    expect(result.matchedSkus).toBe(1);
    expect(result.unmatchedSkus).toBe(1);
    expect(result.tecido).toBe(50);
  });

  it("returns all zeros when there are no sales", () => {
    const result = computeCogsBySku([], [{ sku: "A", tecidoCost: 5, costuraCost: 3, aviamentosCost: 1 }]);
    expect(result).toEqual({
      tecido: 0,
      costura: 0,
      aviamentos: 0,
      matchedSkus: 0,
      unmatchedSkus: 0,
      matchedQuantity: 0,
      totalQuantity: 0,
      coveragePercent: null,
    });
  });

  it("returns all skus unmatched when there is no product cost data at all", () => {
    const result = computeCogsBySku([{ sku: "A", quantity: 3 }], []);
    expect(result.matchedSkus).toBe(0);
    expect(result.unmatchedSkus).toBe(1);
    expect(result.tecido).toBe(0);
  });

  it("computes quantity-based coverage percent", () => {
    const result = computeCogsBySku(
      [
        { sku: "A", quantity: 80 },
        { sku: "UNKNOWN", quantity: 20 },
      ],
      [{ sku: "A", tecidoCost: 5, costuraCost: 3, aviamentosCost: 1 }],
    );
    expect(result.matchedQuantity).toBe(80);
    expect(result.totalQuantity).toBe(100);
    expect(result.coveragePercent).toBe(80);
  });

  it("returns null coverage when there is no quantity sold at all", () => {
    const result = computeCogsBySku([], []);
    expect(result.coveragePercent).toBeNull();
  });
});
