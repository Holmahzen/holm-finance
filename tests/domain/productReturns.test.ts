import { describe, it, expect } from "vitest";
import { buildProductReturns, type ProductMovementRow } from "@/domain/productReturns";

function row(overrides: Partial<ProductMovementRow>): ProductMovementRow {
  return {
    noteId: "n",
    issueMonth: "2026-09",
    direction: "SAIDA",
    purpose: 1,
    cancelled: false,
    recipientUf: "SP",
    intermediaryDocument: null,
    issuerDocument: "x",
    issuerName: "Holm",
    issuerCrt: 1,
    ncm: "62",
    description: "Conjunto Oxford",
    cfop: "5101",
    netValue: 0,
    icmsCode: null,
    icmsValue: 0,
    simplesCreditValue: 0,
    productCode: "COUM.1000G",
    quantity: 1,
    ...overrides,
  };
}

const sale = (code: string, qty: number, value: number) => row({ productCode: code, quantity: qty, netValue: value });
const ret = (code: string, qty: number, value: number) =>
  row({ productCode: code, quantity: qty, netValue: value, direction: "ENTRADA_PROPRIA", cfop: "1202" });

describe("buildProductReturns", () => {
  it("cruza venda e devolução pelo SKU e agrupa os tamanhos no modelo", () => {
    const report = buildProductReturns([
      sale("COUM.1000G", 100, 5600),
      sale("COUM.1000GG", 50, 2800),
      ret("COUM.1000G", 4, 224),
      ret("COUM.1000GG", 10, 560),
    ]);
    const [model] = report.models;
    expect(model.label).toBe("COUM.1000");
    expect(model.returnRate).toBeCloseTo(14 / 150);
    expect(model.sizes.map((s) => [s.size, s.returnRate])).toEqual([
      ["G", 0.04],
      ["GG", 0.2],
    ]);
    expect(report.returnedValue).toBe(784);
  });

  it("ignora nota cancelada e item que não é venda nem devolução", () => {
    const report = buildProductReturns([
      sale("A1", 10, 100),
      row({ productCode: "A1", quantity: 5, netValue: 50, cancelled: true }),
      row({ productCode: "A1", quantity: 3, netValue: 30, cfop: "5949" }),
    ]);
    expect(report.soldQty).toBe(10);
  });

  it("devolução de código que não vendeu no período fica à parte", () => {
    const report = buildProductReturns([sale("A1", 10, 100), ret("MLB999", 1, 50)]);
    expect(report.models).toHaveLength(1);
    expect(report.unmatched).toEqual([{ code: "MLB999", description: "Conjunto Oxford", returnedQty: 1, returnedValue: 50 }]);
    expect(report.returnedValue).toBe(50);
  });

  it("junta grafias diferentes do mesmo SKU", () => {
    const report = buildProductReturns([sale("TOTAC.1001", 10, 100), ret("TOTAC1001", 2, 20)]);
    expect(report.unmatched).toHaveLength(0);
    expect(report.models[0].returnRate).toBeCloseTo(0.2);
  });
});
