import { describe, it, expect } from "vitest";
import {
  classifyDirection,
  computeRbt12,
  detailForMonth,
  isCustomerReturnCfop,
  isOwnProductionSaleCfop,
  isSaleCfop,
  isSaleReturnCfop,
  shiftMonth,
  summarizeMonths,
  type FiscalItemRow,
} from "@/domain/fiscalNotes";

const HOLM = "49046940000100";

function row(overrides: Partial<FiscalItemRow> = {}): FiscalItemRow {
  return {
    noteId: "n1",
    issueMonth: "2026-09",
    direction: "SAIDA",
    purpose: 1,
    cancelled: false,
    recipientUf: "SP",
    intermediaryDocument: "03007331000141",
    issuerDocument: HOLM,
    issuerName: "Holm Confeccoes",
    issuerCrt: 1,
    cfop: "5102",
    netValue: 100,
    icmsCode: "102",
    icmsValue: 0,
    simplesCreditValue: 0,
    ...overrides,
  };
}

describe("classifyDirection", () => {
  it("separa venda, devolução emitida pela Holm, compra e nota de terceiros", () => {
    expect(classifyDirection({ issuerDocument: HOLM, recipientDocument: "123", operationType: 1 })).toBe("SAIDA");
    expect(classifyDirection({ issuerDocument: HOLM, recipientDocument: "123", operationType: 0 })).toBe("ENTRADA_PROPRIA");
    expect(classifyDirection({ issuerDocument: "41631822000158", recipientDocument: HOLM, operationType: 1 })).toBe("ENTRADA_TERCEIRO");
    expect(classifyDirection({ issuerDocument: "1", recipientDocument: "2", operationType: 1 })).toBeNull();
  });
});

describe("CFOPs", () => {
  it("reconhece venda e deixa remessa de fora", () => {
    for (const c of ["5101", "5102", "5105", "6106", "6108", "5124", "5405"]) expect(isSaleCfop(c)).toBe(true);
    for (const c of ["5949", "6905", "5202", "5910", "1202"]) expect(isSaleCfop(c)).toBe(false);
  });

  it("reconhece devolução dos dois lados", () => {
    // os quatro que o faturador do Mercado Livre usa (devolução e retorno de não entregue)
    for (const c of ["1201", "1202", "2201", "2202"]) expect(isSaleReturnCfop(c)).toBe(true);
    expect(isSaleReturnCfop("2411")).toBe(true);
    expect(isSaleReturnCfop("1102")).toBe(false);
    expect(isCustomerReturnCfop("5202")).toBe(true);
    expect(isCustomerReturnCfop("6202")).toBe(true);
    expect(isCustomerReturnCfop("5102")).toBe(false);
  });

  it("separa produção própria de revenda", () => {
    expect(isOwnProductionSaleCfop("5101")).toBe(true);
    expect(isOwnProductionSaleCfop("6105")).toBe(true);
    expect(isOwnProductionSaleCfop("5102")).toBe(false);
    expect(isOwnProductionSaleCfop("6106")).toBe(false);
  });
});

describe("summarizeMonths", () => {
  const rows: FiscalItemRow[] = [
    row({ noteId: "v1", recipientUf: "SP", netValue: 100 }),
    row({ noteId: "v1", recipientUf: "SP", netValue: 50 }), // segundo item da mesma nota
    row({ noteId: "v2", recipientUf: "RJ", cfop: "6102", netValue: 250 }),
    row({ noteId: "v3", recipientUf: "MG", cfop: "6102", netValue: 999, cancelled: true }),
    row({ noteId: "d1", direction: "ENTRADA_PROPRIA", cfop: "2202", netValue: 40 }),
    row({ noteId: "d2", direction: "ENTRADA_TERCEIRO", purpose: 4, cfop: "5202", netValue: 10, issuerDocument: "99" }),
    row({
      noteId: "c1", direction: "ENTRADA_TERCEIRO", cfop: "5102", netValue: 389.5, icmsCode: "00",
      icmsValue: 70.11, issuerDocument: "41631822000158", issuerName: "LA ARTE", issuerCrt: 3,
    }),
    row({ noteId: "r1", cfop: "5949", netValue: 500 }), // remessa, não é venda
    row({ noteId: "v4", issueMonth: "2026-08", netValue: 300 }),
  ];

  it("soma vendas por nota, desconta devoluções e ignora canceladas", () => {
    const [aug, sep] = summarizeMonths(rows);
    expect(aug).toMatchObject({ month: "2026-08", saleNotes: 1, grossSales: 300, netSales: 300 });
    expect(sep).toMatchObject({
      month: "2026-09",
      saleNotes: 2,
      grossSales: 400,
      returns: 50,
      netSales: 350,
      spSales: 150,
      cancelledNotes: 1,
      purchaseNotes: 1,
      purchases: 389.5,
      purchaseIcms: 70.11,
      otherOutflows: 500,
    });
    expect(sep.spShare).toBeCloseTo(0.375, 5);
  });

  it("calcula a RBT12 só com os meses da janela e diz quantos têm nota", () => {
    const months = summarizeMonths(rows);
    expect(computeRbt12(months, "2026-09")).toEqual({
      startMonth: "2025-10",
      endMonth: "2026-09",
      value: 650,
      monthsWithData: 2,
    });
    expect(computeRbt12(months, "2026-08").value).toBe(300);
  });

  it("detalha o mês: estados, origem pelo CFOP, CSOSN 400 e fornecedores", () => {
    const detail = detailForMonth(
      [...rows, row({ noteId: "v5", issuerName: "REGIMAR SOUZA SILVA LTDA", icmsCode: "400", cfop: "6105", recipientUf: "BA", netValue: 60 })],
      "2026-09",
    );
    expect(detail.byUf.map((g) => g.key)).toEqual(["RJ", "SP", "BA"]);
    expect(detail.byOrigin.find((g) => g.key === "Produção própria")?.value).toBe(60);
    expect(detail.csosn400).toEqual({ notes: 1, value: 60 });
    expect(detail.byIssuerName).toHaveLength(2);
    expect(detail.suppliers).toEqual([
      { document: "41631822000158", name: "LA ARTE", crt: 3, notes: 1, value: 389.5, icms: 70.11, simplesCredit: 0 },
    ]);
    expect(detail.byCfopOtherOut).toEqual([{ key: "5949", label: "5949", notes: 1, value: 500, share: 1 }]);
  });
});

describe("shiftMonth", () => {
  it("atravessa a virada do ano", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-09", -11)).toBe("2025-10");
    expect(shiftMonth("2025-12", 1)).toBe("2026-01");
  });
});
