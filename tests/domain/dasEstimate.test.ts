import { describe, it, expect } from "vitest";
import { estimateDasPayments } from "@/domain/dasEstimate";

function utc(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m - 1, d));
}

const base = {
  today: utc(2026, 11, 6),
  windowEnd: utc(2026, 12, 6),
  dueDay: 20,
  dasEntryDates: [] as Date[],
  salesByMonth: { "2026-10": 400_000 },
  apuracoes: {},
};

describe("estimateDasPayments", () => {
  it("estima o DAS de outubro (vence 20/11) pelas notas de saída do mês × 14,4%", () => {
    const [m] = estimateDasPayments(base);
    expect(m.date).toEqual(utc(2026, 11, 20));
    expect(m.amount).toBeCloseTo(-400_000 * 0.144, 2);
    expect(m.label).toContain("outubro");
    expect(m.label).toContain("14,4%");
    expect(m.categoryName).toBe("DAS");
  });

  it("usa o valor oficial do PGDAS-D quando a apuração do mês já foi importada", () => {
    const [m] = estimateDasPayments({
      ...base,
      apuracoes: { "2026-10": { total: 51_000, dueDate: utc(2026, 11, 20) } },
    });
    expect(m.amount).toBe(-51_000);
    expect(m.label).toContain("oficial");
  });

  it("some quando já existe o lançamento real do DAS daquele mês", () => {
    expect(estimateDasPayments({ ...base, dasEntryDates: [utc(2026, 11, 20)] })).toEqual([]);
  });

  it("o DAS pago no mês anterior (referente setembro) não esconde o de outubro", () => {
    expect(estimateDasPayments({ ...base, dasEntryDates: [utc(2026, 10, 20)] })).toHaveLength(1);
  });

  it("vencimento em fim de semana é pago na sexta", () => {
    // 20/09/2026 é domingo
    const [m] = estimateDasPayments({
      ...base,
      today: utc(2026, 9, 1),
      windowEnd: utc(2026, 10, 1),
      salesByMonth: { "2026-08": 100_000 },
    });
    expect(m.date).toEqual(utc(2026, 9, 18));
  });

  it("depois do dia 15, projeta o DAS do mês corrente pelo ritmo das notas até hoje", () => {
    const m = estimateDasPayments({
      ...base,
      today: utc(2026, 11, 25),
      windowEnd: utc(2026, 12, 31),
      salesByMonth: { "2026-11": 250_000 },
    });
    expect(m).toHaveLength(1);
    expect(m[0].date).toEqual(utc(2026, 12, 18)); // 20/12 é domingo
    // 250 mil em 25 dias → 300 mil no mês de 30 dias
    expect(m[0].amount).toBeCloseTo(-300_000 * 0.144, 2);
    expect(m[0].label).toContain("projetadas");
  });

  it("no começo do mês corrente usa as notas do mês anterior, não o ritmo de poucos dias", () => {
    const m = estimateDasPayments({
      ...base,
      today: utc(2026, 11, 6),
      windowEnd: utc(2026, 12, 31),
      salesByMonth: { "2026-10": 400_000, "2026-11": 37_000 },
    });
    expect(m).toHaveLength(2);
    expect(m[1].amount).toBeCloseTo(-400_000 * 0.144, 2);
    expect(m[1].label).toContain("mês anterior");
  });

  it("sem nenhuma nota do mês corrente importada ainda, também usa o mês anterior", () => {
    const m = estimateDasPayments({ ...base, windowEnd: utc(2026, 12, 31), salesByMonth: { "2026-10": 400_000 } });
    expect(m).toHaveLength(2);
    expect(m[1].amount).toBeCloseTo(-400_000 * 0.144, 2);
  });

  it("no começo do mês a referência é a venda bruta do mês anterior, não a líquida distorcida por devoluções", () => {
    const m = estimateDasPayments({
      ...base,
      windowEnd: utc(2026, 12, 31),
      salesByMonth: { "2026-10": 57_000 },
      grossSalesByMonth: { "2026-10": 400_000 },
    });
    expect(m[0].amount).toBeCloseTo(-57_000 * 0.144, 2); // outubro, líquido das devoluções
    expect(m[1].amount).toBeCloseTo(-400_000 * 0.144, 2); // novembro, base bruta
    expect(m[1].label).toContain("brutas");
  });

  it("não projeta DAS que já passou nem fora do período", () => {
    expect(estimateDasPayments({ ...base, today: utc(2026, 11, 21), windowEnd: utc(2026, 11, 30) })).toEqual([]);
    expect(estimateDasPayments({ ...base, windowEnd: utc(2026, 11, 19) })).toEqual([]);
  });

  it("sem notas do mês não inventa valor", () => {
    expect(estimateDasPayments({ ...base, salesByMonth: {} })).toEqual([]);
  });
});
