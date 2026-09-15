import { describe, it, expect } from "vitest";
import { findNumericNamedProducts, pickSuggestedNames } from "@/domain/productSuspicious";

describe("findNumericNamedProducts", () => {
  it("finds only active products whose name is a bare number", () => {
    const products = [
      { id: "1", sku: "A1", name: "2,37", isActive: true },
      { id: "2", sku: "A2", name: "Calça Oxford", isActive: true },
      { id: "3", sku: "A3", name: "14", isActive: false },
      { id: "4", sku: null, name: "27,9", isActive: true },
    ];
    expect(findNumericNamedProducts(products)).toEqual([products[0]]);
  });
});

describe("pickSuggestedNames", () => {
  it("picks the most frequent product name per SKU", () => {
    const sales = [
      { sku: "CAL1001P", productName: "Roupa Umbanda Calça" },
      { sku: "CAL1001P", productName: "Roupa Umbanda Calça" },
      { sku: "CAL1001P", productName: "Calça digitada errado" },
      { sku: "V-BAND1000", productName: "Bandana" },
    ];
    const result = pickSuggestedNames(sales);
    expect(result.get("CAL1001P")).toBe("Roupa Umbanda Calça");
    expect(result.get("V-BAND1000")).toBe("Bandana");
  });

  it("ignores empty product names and returns no entry for SKUs without sales", () => {
    const result = pickSuggestedNames([{ sku: "X1", productName: "" }]);
    expect(result.has("X1")).toBe(false);
  });
});
