import { describe, it, expect } from "vitest";
import { directSalesChannel, marketplaceChannel } from "@/domain/channelMargin";
import type { ProductMovementRow } from "@/domain/productReturns";

const costs = new Map([["TOUCA", { tecidoCost: 3, costuraCost: 2, aviamentosCost: 1 }]]);

const sale = (overrides: Partial<{ sku: string; quantity: number; grossRevenue: number; netRevenue: number; marketplaceCost: number; shippingModality: string }> = {}) => ({
  sku: "TOUCA",
  productName: "Touca",
  quantity: 10,
  grossRevenue: 200,
  netRevenue: 120,
  marketplaceCost: 0,
  status: "Pago",
  shippingModality: "Full",
  ...overrides,
});

describe("marketplaceChannel", () => {
  it("desconta o imposto quando o relatório não traz (taxRate > 0)", () => {
    const ch = marketplaceChannel("shopee", [sale()], costs, 0.14);
    // 120 − 14% de 200 − 6 × 10
    expect(ch.contribution).toBeCloseTo(120 - 28 - 60);
    expect(ch.tax).toBeCloseTo(28);
    expect(ch.marketplaceFees).toBeCloseTo(80);
    expect(ch.marginPercent).toBeCloseTo(32 / 200);
  });

  it("com imposto já descontado no relatório, tira só Flex, Ads e Full", () => {
    const ch = marketplaceChannel("mercadoLivre", [sale({ shippingModality: "Flex", quantity: 1, grossRevenue: 20, netRevenue: 12 })], costs, 0, 1, 0.5);
    expect(ch.tax).toBe(0);
    // 12 − 12,99 de Flex − 6 de custo − 1 de Ads − 0,5 de Full
    expect(ch.contribution).toBeCloseTo(12 - 12.99 - 6 - 1 - 0.5);
  });

  it("SKU sem custo entra na receita mas não na margem", () => {
    const ch = marketplaceChannel("shopee", [sale(), sale({ sku: "SEM-CUSTO" })], costs, 0.14);
    expect(ch.revenue).toBe(400);
    expect(ch.costCoverage).toBeCloseTo(0.5);
    expect(ch.marginPercent).toBeCloseTo(32 / 200);
  });
});

function noteItem(overrides: Partial<ProductMovementRow>): ProductMovementRow {
  return {
    noteId: "n", issueMonth: "2026-09", direction: "SAIDA", purpose: 1, cancelled: false, recipientUf: "PR",
    intermediaryDocument: null, issuerDocument: "x", issuerName: "Holm", issuerCrt: 1, ncm: "62",
    description: "Touca", cfop: "5101", netValue: 100, icmsCode: null, icmsValue: 0, simplesCreditValue: 0,
    productCode: "TOUCA", quantity: 10, ...overrides,
  };
}

describe("directSalesChannel", () => {
  it("usa só nota de venda sem intermediador e desconta imposto e custo", () => {
    const ch = directSalesChannel(
      [
        noteItem({}),
        noteItem({ intermediaryDocument: "03007331000141" }), // Mercado Livre
        noteItem({ cancelled: true }),
        noteItem({ direction: "ENTRADA_PROPRIA", cfop: "1202" }), // devolução
      ],
      costs,
      0.14,
    );
    expect(ch.revenue).toBe(100);
    expect(ch.contribution).toBeCloseTo(100 * 0.86 - 60);
  });
});
