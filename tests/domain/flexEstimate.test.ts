import { describe, it, expect } from "vitest";
import { estimateFlexInvoices, fortnightOf } from "@/domain/flexEstimate";

function utc(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m - 1, d));
}

const FEE = 12.99;

describe("fortnightOf", () => {
  it("dia 15 fecha a primeira quinzena, dia 16 abre a segunda", () => {
    expect(fortnightOf(utc(2026, 9, 15))).toMatchObject({ start: utc(2026, 9, 1), end: utc(2026, 9, 15), days: 15 });
    expect(fortnightOf(utc(2026, 9, 16))).toMatchObject({ start: utc(2026, 9, 16), end: utc(2026, 9, 30), days: 15 });
  });

  it("segunda quinzena vai até o fim do mês (31 dias = 16 dias, fevereiro = 13 ou 14)", () => {
    expect(fortnightOf(utc(2026, 10, 20)).days).toBe(16);
    expect(fortnightOf(utc(2026, 2, 20))).toMatchObject({ end: utc(2026, 2, 28), days: 13 });
  });
});

describe("estimateFlexInvoices", () => {
  const base = {
    today: utc(2026, 9, 24),
    windowEnd: utc(2026, 10, 24),
    feePerPackage: FEE,
    paceFlexPerDay: 20,
    lastSaleDate: utc(2026, 9, 23),
  };

  // 231 pedidos Flex de 16/09 a 23/09 (8 dias), 30/dia aprox.
  const flexSep16to23 = Array.from({ length: 8 }, (_, i) => ({ date: utc(2026, 9, 16 + i), flexCount: 30 }));

  it("projeta a quinzena aberta pelo ritmo dela e paga 4 dias depois do fechamento", () => {
    const m = estimateFlexInvoices({ ...base, flexByDay: flexSep16to23, flexEntries: [] });
    const cur = m.find((x) => x.label.includes("16/09–30/09"))!;
    // 240 até 23/09 + 7 dias restantes × 30 = 450 pedidos
    expect(cur.amount).toBeCloseTo(-450 * FEE, 2);
    expect(cur.date).toEqual(utc(2026, 10, 4));
    expect(cur.label).toContain("vendas até 23/09");
  });

  it("quinzena sem venda importada usa o ritmo dos últimos 30 dias", () => {
    const m = estimateFlexInvoices({ ...base, flexByDay: flexSep16to23, flexEntries: [] });
    const next = m.find((x) => x.label.includes("01/10–15/10"))!;
    expect(next.amount).toBeCloseTo(-15 * 20 * FEE, 2);
    expect(next.date).toEqual(utc(2026, 10, 19));
    expect(next.label).toContain("ritmo dos últimos 30 dias");
  });

  it("some quando a fatura real da quinzena já foi lançada", () => {
    const m = estimateFlexInvoices({
      ...base,
      flexByDay: [...Array.from({ length: 15 }, (_, i) => ({ date: utc(2026, 9, 1 + i), flexCount: 25 })), ...flexSep16to23],
      // fatura de 1–15/09 paga em 21/09
      flexEntries: [{ date: utc(2026, 9, 21), amount: 4546.5 }],
    });
    expect(m.some((x) => x.label.includes("01/09–15/09"))).toBe(false);
  });

  it("lançamento avulso pequeno de Flex não esconde a estimativa", () => {
    const m = estimateFlexInvoices({
      ...base,
      flexByDay: Array.from({ length: 15 }, (_, i) => ({ date: utc(2026, 9, 1 + i), flexCount: 25 })),
      flexEntries: [{ date: utc(2026, 9, 21), amount: 58.99 }],
    });
    expect(m.some((x) => x.label.includes("01/09–15/09"))).toBe(true);
  });

  it("fatura já vencida e ainda sem lançamento cai em hoje, não no passado", () => {
    const m = estimateFlexInvoices({
      ...base,
      flexByDay: Array.from({ length: 15 }, (_, i) => ({ date: utc(2026, 9, 1 + i), flexCount: 25 })),
      flexEntries: [],
    });
    const overdue = m.find((x) => x.label.includes("01/09–15/09"))!;
    expect(overdue.date).toEqual(base.today);
  });

  it("poucos dias de dado (<3) na quinzena não distorcem o ritmo", () => {
    const m = estimateFlexInvoices({
      ...base,
      today: utc(2026, 10, 2),
      windowEnd: utc(2026, 10, 30),
      lastSaleDate: utc(2026, 10, 1),
      flexByDay: [{ date: utc(2026, 10, 1), flexCount: 100 }],
      flexEntries: [],
    });
    const cur = m.find((x) => x.label.includes("01/10–15/10"))!;
    // 100 já contados + 14 dias restantes × ritmo de 20 (não 100/dia)
    expect(cur.amount).toBeCloseTo(-(100 + 14 * 20) * FEE, 2);
  });

  it("ignora quinzena cuja fatura cai depois da janela", () => {
    const m = estimateFlexInvoices({ ...base, windowEnd: utc(2026, 10, 3), flexByDay: flexSep16to23, flexEntries: [] });
    expect(m.every((x) => x.date < utc(2026, 10, 3))).toBe(true);
  });

  it("sem nenhum Flex nem ritmo, não estima nada", () => {
    expect(estimateFlexInvoices({ ...base, paceFlexPerDay: 0, flexByDay: [], flexEntries: [] })).toEqual([]);
  });
});
