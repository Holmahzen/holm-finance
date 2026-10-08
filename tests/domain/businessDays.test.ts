import { describe, it, expect } from "vitest";
import { payBeforeWeekend, weekendPaymentDate } from "@/domain/businessDays";

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe("payBeforeWeekend", () => {
  it("sábado vai para a sexta anterior (10/10/2026 → 09/10/2026)", () => {
    expect(payBeforeWeekend(utc(2026, 10, 10))).toEqual(utc(2026, 10, 9));
  });

  it("domingo também vai para a sexta anterior", () => {
    expect(payBeforeWeekend(utc(2026, 10, 11))).toEqual(utc(2026, 10, 9));
  });

  it("dia útil não muda", () => {
    expect(payBeforeWeekend(utc(2026, 10, 9))).toEqual(utc(2026, 10, 9));
    expect(payBeforeWeekend(utc(2026, 10, 12))).toEqual(utc(2026, 10, 12));
  });

  it("atravessa o fim do mês", () => {
    // 01/11/2026 é domingo → sexta 30/10
    expect(payBeforeWeekend(utc(2026, 11, 1))).toEqual(utc(2026, 10, 30));
  });
});

describe("weekendPaymentDate", () => {
  it("só devolve data quando precisou adiantar", () => {
    expect(weekendPaymentDate(utc(2026, 10, 10))).toEqual(utc(2026, 10, 9));
    expect(weekendPaymentDate(utc(2026, 10, 9))).toBeUndefined();
  });
});
