import { describe, it, expect } from "vitest";
import { computeFixedCostDueDates, computeFixedCostMonthlyAmount } from "@/domain/fixedCostSchedule";

function isoDates(dates: Date[]) {
  return dates.map((d) => d.toISOString().slice(0, 10));
}

describe("computeFixedCostDueDates", () => {
  describe("MONTHLY", () => {
    it("returns a single date on the configured day", () => {
      const dates = computeFixedCostDueDates(
        { frequency: "MONTHLY", dueDay: 5, secondDueDay: null, weekday: null },
        2026,
        8,
      );
      expect(isoDates(dates)).toEqual(["2026-08-05"]);
    });

    it("clamps to the last day of a shorter month", () => {
      const dates = computeFixedCostDueDates(
        { frequency: "MONTHLY", dueDay: 31, secondDueDay: null, weekday: null },
        2026,
        2,
      );
      expect(isoDates(dates)).toEqual(["2026-02-28"]);
    });

    it("returns an empty array when dueDay is missing", () => {
      const dates = computeFixedCostDueDates(
        { frequency: "MONTHLY", dueDay: null, secondDueDay: null, weekday: null },
        2026,
        8,
      );
      expect(dates).toEqual([]);
    });
  });

  describe("BIWEEKLY", () => {
    it("returns both dates sorted chronologically", () => {
      const dates = computeFixedCostDueDates(
        { frequency: "BIWEEKLY", dueDay: 20, secondDueDay: 5, weekday: null },
        2026,
        8,
      );
      expect(isoDates(dates)).toEqual(["2026-08-05", "2026-08-20"]);
    });

    it("clamps each day independently to the month length", () => {
      const dates = computeFixedCostDueDates(
        { frequency: "BIWEEKLY", dueDay: 15, secondDueDay: 31, weekday: null },
        2026,
        2,
      );
      expect(isoDates(dates)).toEqual(["2026-02-15", "2026-02-28"]);
    });

    it("returns an empty array when either day is missing", () => {
      expect(
        computeFixedCostDueDates(
          { frequency: "BIWEEKLY", dueDay: 15, secondDueDay: null, weekday: null },
          2026,
          8,
        ),
      ).toEqual([]);
    });
  });

  describe("WEEKLY", () => {
    it("returns one date per occurrence of the weekday in the month", () => {
      // Agosto/2026: sexta-feira (5) cai nos dias 7, 14, 21 e 28
      const dates = computeFixedCostDueDates(
        { frequency: "WEEKLY", dueDay: null, secondDueDay: null, weekday: 5 },
        2026,
        8,
      );
      expect(isoDates(dates)).toEqual(["2026-08-07", "2026-08-14", "2026-08-21", "2026-08-28"]);
    });

    it("can return 5 occurrences in a month with 5 of that weekday", () => {
      // Julho/2026: sexta-feira cai nos dias 3, 10, 17, 24 e 31
      const dates = computeFixedCostDueDates(
        { frequency: "WEEKLY", dueDay: null, secondDueDay: null, weekday: 5 },
        2026,
        7,
      );
      expect(dates).toHaveLength(5);
      for (const d of dates) expect(d.getUTCDay()).toBe(5);
    });

    it("returns an empty array when weekday is missing", () => {
      expect(
        computeFixedCostDueDates(
          { frequency: "WEEKLY", dueDay: null, secondDueDay: null, weekday: null },
          2026,
          8,
        ),
      ).toEqual([]);
    });
  });
});

describe("computeFixedCostMonthlyAmount", () => {
  it("returns the raw amount once for a monthly cost", () => {
    const total = computeFixedCostMonthlyAmount(
      { frequency: "MONTHLY", dueDay: 5, secondDueDay: null, weekday: null, amount: 4000 },
      2026,
      8,
    );
    expect(total).toBe(4000);
  });

  it("multiplies by 4 occurrences for a weekly cost in a 4-Friday month", () => {
    // Agosto/2026 tem 4 sextas-feiras (bug real: um custo semanal de R$4.000
    // não custa R$4.000/mês, custa 4x isso).
    const total = computeFixedCostMonthlyAmount(
      { frequency: "WEEKLY", dueDay: null, secondDueDay: null, weekday: 5, amount: 4000 },
      2026,
      8,
    );
    expect(total).toBe(16000);
  });

  it("multiplies by 5 occurrences for a weekly cost in a 5-Friday month", () => {
    const total = computeFixedCostMonthlyAmount(
      { frequency: "WEEKLY", dueDay: null, secondDueDay: null, weekday: 5, amount: 4000 },
      2026,
      7,
    );
    expect(total).toBe(20000);
  });

  it("doubles the amount for a biweekly cost", () => {
    const total = computeFixedCostMonthlyAmount(
      { frequency: "BIWEEKLY", dueDay: 5, secondDueDay: 20, weekday: null, amount: 1000 },
      2026,
      8,
    );
    expect(total).toBe(2000);
  });
});
