import { describe, it, expect } from "vitest";
import {
  classifyMlService,
  mlServiceDedupeKey,
  mlServiceDetailForMonth,
  mlServiceTotalsByMonth,
  type MlServiceRow,
} from "@/domain/mlServices";

function row(overrides: Partial<MlServiceRow> = {}): MlServiceRow {
  return {
    referenceMonth: "2026-08",
    providerName: "EBAZAR.COM.BR.LTDA",
    providerDocument: "03007331000141",
    providerCity: "Osasco",
    amount: 100,
    issuedOn: "2026-08-19",
    link: "https://nfe.osasco.sp.gov.br/x?Id=1",
    ...overrides,
  };
}

describe("classifyMlService", () => {
  it("separa frete, Mercado Pago e o resto da Ebazar pelo prestador", () => {
    expect(classifyMlService("03007331001202", "E200-ENVIOS - Mooca")).toBe("FRETE");
    expect(classifyMlService("10573521000191", "MERCADOPAGO INSTITUIÇÃO PAGAMENTO L")).toBe("MERCADO_PAGO");
    expect(classifyMlService("03007331000141", "EBAZAR.COM.BR.LTDA")).toBe("EBAZAR");
  });
});

describe("mlServiceDedupeKey", () => {
  const base = { providerDocument: "03007331001202", issuedOn: new Date(Date.UTC(2026, 7, 19)), amount: 926.72 };

  it("usa o link quando ele identifica a nota", () => {
    expect(mlServiceDedupeKey({ ...base, link: "https://nfe.osasco.sp.gov.br/x?Id=ABC" }, "1.PDF")).toBe(
      "https://nfe.osasco.sp.gov.br/x?Id=ABC",
    );
  });

  it("não confia no link genérico da prefeitura de SP", () => {
    const a = mlServiceDedupeKey({ ...base, link: "https://nfe.prefeitura.sp.gov.br/rps.aspx" }, "00000000000001451484.PDF");
    const b = mlServiceDedupeKey(
      { ...base, amount: 1461.74, link: "https://nfe.prefeitura.sp.gov.br/rps.aspx" },
      "pasta/00000000000001451483.PDF",
    );
    expect(a).toBe("03007331001202|2026-08-19|926.72|1451484");
    expect(a).not.toBe(b);
  });
});

describe("resumo do mês", () => {
  const rows = [
    row({ amount: 56340.32 }),
    row({ providerName: "E200-ENVIOS - Mooca", providerDocument: "03007331001202", amount: 1461.74 }),
    row({ providerName: "MERCADOPAGO INSTITUIÇÃO PAGAMENTO L", providerDocument: "10573521000191", amount: 4734.4 }),
    row({ referenceMonth: "2026-07", amount: 999 }),
  ];

  it("soma por mês", () => {
    expect(mlServiceTotalsByMonth(rows)).toEqual({ "2026-08": 62536.46, "2026-07": 999 });
  });

  it("agrupa o mês por tipo, do maior para o menor", () => {
    const detail = mlServiceDetailForMonth(rows, "2026-08");
    expect(detail.count).toBe(3);
    expect(detail.total).toBeCloseTo(62536.46, 2);
    expect(detail.byCategory.map((g) => g.key)).toEqual(["EBAZAR", "MERCADO_PAGO", "FRETE"]);
    expect(detail.invoices[0]).toMatchObject({ amount: 56340.32, category: "EBAZAR" });
  });
});
