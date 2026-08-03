import { describe, it, expect } from "vitest";
import { computeAvgMonthlyQuantityBySku } from "@/domain/avgMonthlyQuantity";

describe("computeAvgMonthlyQuantityBySku", () => {
  it("divides total quantity by months count", () => {
    const result = computeAvgMonthlyQuantityBySku(
      [
        { sku: "A", quantity: 100 },
        { sku: "B", quantity: 30 },
      ],
      4,
    );
    expect(result).toEqual({ A: 25, B: 8 });
  });

  it("rounds to the nearest integer", () => {
    const result = computeAvgMonthlyQuantityBySku([{ sku: "A", quantity: 10 }], 3);
    expect(result.A).toBe(3);
  });

  it("returns empty object when there are no months", () => {
    const result = computeAvgMonthlyQuantityBySku([{ sku: "A", quantity: 10 }], 0);
    expect(result).toEqual({});
  });

  it("handles multiple SKUs independently", () => {
    const result = computeAvgMonthlyQuantityBySku(
      [
        { sku: "X", quantity: 12 },
        { sku: "Y", quantity: 7 },
        { sku: "Z", quantity: 0 },
      ],
      2,
    );
    expect(result).toEqual({ X: 6, Y: 4, Z: 0 });
  });
});
