import { describe, it, expect } from "vitest";
import { codeBreakdown, icmsCodeKey, icmsCodeLabel } from "@/domain/fiscalCodes";
import type { FiscalItemRow } from "@/domain/fiscalNotes";

function row(overrides: Partial<FiscalItemRow> = {}): FiscalItemRow {
  return {
    noteId: "n1",
    issueMonth: "2026-09",
    direction: "SAIDA",
    purpose: 1,
    cancelled: false,
    recipientUf: "SP",
    intermediaryDocument: null,
    issuerDocument: "49046940000100",
    issuerName: "Holm Confeccoes",
    issuerCrt: 1,
    ncm: "61059000",
    description: "JALECO CAVADO - G",
    cfop: "6105",
    netValue: 50,
    icmsCode: "102",
    icmsValue: 0,
    simplesCreditValue: 0,
    ...overrides,
  };
}

describe("icmsCode", () => {
  it("diferencia CSOSN (Simples) de CST (regime normal)", () => {
    expect(icmsCodeKey("400")).toBe("CSOSN 400");
    expect(icmsCodeKey("00")).toBe("CST 00");
    expect(icmsCodeLabel("400")).toContain("não tributada pelo Simples");
    expect(icmsCodeLabel("00")).toContain("tributada integralmente");
    expect(icmsCodeLabel(null)).toBe("item sem grupo de ICMS");
  });
});

describe("codeBreakdown", () => {
  const rows = [
    row({ noteId: "a", netValue: 50 }),
    row({ noteId: "a", ncm: "62046300", description: "CONJUNTO COPEIRA", cfop: "6102", netValue: 30 }),
    row({ noteId: "b", netValue: 120, description: "JALECO LONGO - M", icmsCode: "400" }),
    row({ noteId: "c", netValue: 999, cancelled: true }),
    row({ noteId: "d", direction: "ENTRADA_PROPRIA", cfop: "2202", netValue: 40 }),
    row({
      noteId: "e", direction: "ENTRADA_TERCEIRO", issuerDocument: "41631822000158", cfop: "5102",
      ncm: "58042100", description: "BORDADO", icmsCode: "00", netValue: 389.5,
    }),
  ];

  it("agrupa as vendas por NCM com o produto de maior valor como exemplo", () => {
    const sale = codeBreakdown(rows, "2026-09", "sale");
    expect(sale.byNcm).toEqual([
      { code: "61059000", label: "JALECO LONGO - M", notes: 2, value: 170, share: 0.85 },
      { code: "62046300", label: "CONJUNTO COPEIRA", notes: 1, value: 30, share: 0.15 },
    ]);
    expect(sale.byCfop.map((g) => [g.code, g.value])).toEqual([["6105", 170], ["6102", 30]]);
    expect(sale.byCfop[0].label).toContain("produção própria");
    expect(sale.byIcmsCode.map((g) => [g.code, g.value])).toEqual([["CSOSN 400", 120], ["CSOSN 102", 80]]);
  });

  it("separa devoluções e compras, com os códigos de quem emitiu", () => {
    expect(codeBreakdown(rows, "2026-09", "return").byCfop).toMatchObject([{ code: "2202", value: 40 }]);
    const purchase = codeBreakdown(rows, "2026-09", "purchase");
    expect(purchase.byNcm).toMatchObject([{ code: "58042100", label: "BORDADO" }]);
    expect(purchase.byIcmsCode).toMatchObject([{ code: "CST 00" }]);
  });
});
