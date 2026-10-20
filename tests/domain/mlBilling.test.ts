import { describe, it, expect } from "vitest";
import { billingGroup, billingTotals, summarizeMlBillingRows } from "@/domain/mlBilling";

const HEADER = ["N° NF-e", "Data da tarifa", "Número da tarifa", "Detalhe", "Descontado da operação", "Status da tarifa", "Tarifa cancelada", "Valor da tarifa"];
const d = (day: number) => new Date(Date.UTC(2026, 9, day));
const row = (date: Date | number, detail: string, deducted: string, value: number | string) => ["", date, 1, detail, deducted, "", "", value];

describe("summarizeMlBillingRows", () => {
  const rows = [
    ["Data de atualização", "", 46315.7],
    [],
    HEADER,
    row(d(1), "Custo por vender no Mercado Livre", "Sim", 10),
    row(d(2), "Custo por vender no Mercado Livre", "Sim", 5.5),
    row(d(19), "Tarifa por campanha de publicidade de Product Ads", "Não", 3),
    row(46270, "Tarifa pelo serviço de armazenamento Full", "Não", 2),
    row(d(5), "Tarifa de devolução", "Não se aplica", -1.25),
    row(d(5), "Linha sem valor", "Sim", ""),
  ];

  it("soma por tipo e por 'descontado da operação' e acha o período", () => {
    const s = summarizeMlBillingRows(rows);
    expect(s.periodStart).toBe("2026-09-05"); // serial do Excel 46270
    expect(s.periodEnd).toBe("2026-10-19");
    const venda = s.lines.find((l) => l.detail.startsWith("Custo por vender"))!;
    expect(venda).toMatchObject({ deducted: "SIM", count: 2, amount: 15.5 });
    expect(s.lines.find((l) => l.deducted === "NA")?.amount).toBe(-1.25);
    expect(s.lines).toHaveLength(4); // a linha sem valor fica de fora
  });

  it("separa fatura a pagar de já descontado", () => {
    const t = billingTotals(summarizeMlBillingRows(rows).lines);
    expect(t).toEqual({ billed: 5, deducted: 15.5, notApplicable: -1.25, total: 19.25 });
  });

  it("recusa planilha que não é o relatório", () => {
    expect(() => summarizeMlBillingRows([["a", "b"], [1, 2]])).toThrow(/Relatório de Faturamento/);
  });
});

describe("billingGroup", () => {
  it("classifica as tarifas pelo nome", () => {
    expect(billingGroup("Tarifa por campanha de publicidade de Product Ads")).toBe("ads");
    expect(billingGroup("Tarifa pelo serviço de armazenamento Full")).toBe("full");
    expect(billingGroup("Tarifa de envio extra ou intermunicipal")).toBe("frete");
    expect(billingGroup("Custo por vender no Mercado Livre")).toBe("venda");
    expect(billingGroup("Custo por cobrar no Mercado Pago")).toBe("pagamento");
    expect(billingGroup("Taxa de parcelamento")).toBe("pagamento");
    expect(billingGroup("Tarifa de manutenção da Minha página")).toBe("outros");
  });
});
