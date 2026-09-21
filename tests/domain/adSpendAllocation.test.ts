import { describe, it, expect } from "vitest";
import { allocateAdSpendBySku } from "@/domain/adSpendAllocation";

describe("allocateAdSpendBySku", () => {
  it("da o investimento inteiro ao SKU quando o anuncio so vendeu um SKU no periodo", () => {
    const sales = [{ sku: "A1", listingCode: "MLB1", grossRevenue: 100 }];
    const adSpend = [{ listingCode: "MLB1", investimento: 30 }];
    const result = allocateAdSpendBySku(sales, adSpend);
    expect(result.get("A1")).toBeCloseTo(30);
  });

  it("divide o investimento entre os SKUs de um mesmo anuncio proporcional a receita de cada um", () => {
    const sales = [
      { sku: "P", listingCode: "MLB1", grossRevenue: 100 },
      { sku: "M", listingCode: "MLB1", grossRevenue: 300 },
    ];
    const adSpend = [{ listingCode: "MLB1", investimento: 40 }];
    const result = allocateAdSpendBySku(sales, adSpend);
    expect(result.get("P")).toBeCloseTo(10); // 25% da receita do anuncio
    expect(result.get("M")).toBeCloseTo(30); // 75% da receita do anuncio
  });

  it("soma vendas repetidas do mesmo SKU sob o mesmo anuncio antes de calcular a proporcao", () => {
    const sales = [
      { sku: "P", listingCode: "MLB1", grossRevenue: 50 },
      { sku: "P", listingCode: "MLB1", grossRevenue: 50 },
      { sku: "M", listingCode: "MLB1", grossRevenue: 100 },
    ];
    const adSpend = [{ listingCode: "MLB1", investimento: 20 }];
    const result = allocateAdSpendBySku(sales, adSpend);
    expect(result.get("P")).toBeCloseTo(10); // 100 de 200 = 50%
    expect(result.get("M")).toBeCloseTo(10);
  });

  it("divide igual entre os SKUs quando nenhum teve receita no periodo (ex.: so cancelamento)", () => {
    const sales = [
      { sku: "P", listingCode: "MLB1", grossRevenue: 0 },
      { sku: "M", listingCode: "MLB1", grossRevenue: 0 },
    ];
    const adSpend = [{ listingCode: "MLB1", investimento: 20 }];
    const result = allocateAdSpendBySku(sales, adSpend);
    expect(result.get("P")).toBeCloseTo(10);
    expect(result.get("M")).toBeCloseTo(10);
  });

  it("ignora investimento de anuncio que nao vendeu nenhum SKU no periodo", () => {
    const sales = [{ sku: "A1", listingCode: "MLB1", grossRevenue: 100 }];
    const adSpend = [{ listingCode: "MLB-SEM-VENDA", investimento: 30 }];
    const result = allocateAdSpendBySku(sales, adSpend);
    expect(result.size).toBe(0);
  });

  it("ignora vendas sem codigo de anuncio", () => {
    const sales = [{ sku: "A1", listingCode: null, grossRevenue: 100 }];
    const adSpend = [{ listingCode: "MLB1", investimento: 30 }];
    const result = allocateAdSpendBySku(sales, adSpend);
    expect(result.size).toBe(0);
  });

  it("soma investimentos de multiplas linhas (campanhas diferentes) do mesmo anuncio", () => {
    const sales = [{ sku: "A1", listingCode: "MLB1", grossRevenue: 100 }];
    const adSpend = [
      { listingCode: "MLB1", investimento: 10 },
      { listingCode: "MLB1", investimento: 15 },
    ];
    const result = allocateAdSpendBySku(sales, adSpend);
    expect(result.get("A1")).toBeCloseTo(25);
  });
});
