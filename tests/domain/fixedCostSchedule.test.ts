import { describe, it, expect } from "vitest";
import { computeFixedCostDueDates, computeFixedCostMonthlyAmount } from "@/domain/fixedCostSchedule";

function isoDates(dates: Date[]) {
  return dates.map((d) => d.toISOString().slice(0, 10));
}

describe("computeFixedCostDueDates", () => {
  describe("MONTHLY", () => {
    it("returns a single date on the configured day", () => {
      const dates = computeFixedCostDueDates(
        { frequency: "MONTHLY", dueDay: 5, secondDueDay: null, weekday: null, anchorDate: null },
        2026,
        8,
      );
      expect(isoDates(dates)).toEqual(["2026-08-05"]);
    });

    it("clamps to the last day of a shorter month", () => {
      const dates = computeFixedCostDueDates(
        { frequency: "MONTHLY", dueDay: 31, secondDueDay: null, weekday: null, anchorDate: null },
        2026,
        2,
      );
      expect(isoDates(dates)).toEqual(["2026-02-28"]);
    });

    it("returns an empty array when dueDay is missing", () => {
      const dates = computeFixedCostDueDates(
        { frequency: "MONTHLY", dueDay: null, secondDueDay: null, weekday: null, anchorDate: null },
        2026,
        8,
      );
      expect(dates).toEqual([]);
    });
  });

  describe("BIWEEKLY", () => {
    it("returns both dates sorted chronologically", () => {
      const dates = computeFixedCostDueDates(
        { frequency: "BIWEEKLY", dueDay: 20, secondDueDay: 5, weekday: null, anchorDate: null },
        2026,
        8,
      );
      expect(isoDates(dates)).toEqual(["2026-08-05", "2026-08-20"]);
    });

    it("clamps each day independently to the month length", () => {
      const dates = computeFixedCostDueDates(
        { frequency: "BIWEEKLY", dueDay: 15, secondDueDay: 31, weekday: null, anchorDate: null },
        2026,
        2,
      );
      expect(isoDates(dates)).toEqual(["2026-02-15", "2026-02-28"]);
    });

    it("returns an empty array when either day is missing", () => {
      expect(
        computeFixedCostDueDates(
          { frequency: "BIWEEKLY", dueDay: 15, secondDueDay: null, weekday: null, anchorDate: null },
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
        { frequency: "WEEKLY", dueDay: null, secondDueDay: null, weekday: 5, anchorDate: null },
        2026,
        8,
      );
      expect(isoDates(dates)).toEqual(["2026-08-07", "2026-08-14", "2026-08-21", "2026-08-28"]);
    });

    it("can return 5 occurrences in a month with 5 of that weekday", () => {
      // Julho/2026: sexta-feira cai nos dias 3, 10, 17, 24 e 31
      const dates = computeFixedCostDueDates(
        { frequency: "WEEKLY", dueDay: null, secondDueDay: null, weekday: 5, anchorDate: null },
        2026,
        7,
      );
      expect(dates).toHaveLength(5);
      for (const d of dates) expect(d.getUTCDay()).toBe(5);
    });

    it("returns an empty array when weekday is missing", () => {
      expect(
        computeFixedCostDueDates(
          { frequency: "WEEKLY", dueDay: null, secondDueDay: null, weekday: null, anchorDate: null },
          2026,
          8,
        ),
      ).toEqual([]);
    });
  });

  describe("BIWEEKLY_ROLLING", () => {
    it("rolls forward every 14 days from the anchor, crossing into the next month", () => {
      // Ancora 11/09/2026 -> 25/09, depois 09/10 (já fora de setembro).
      const dates = computeFixedCostDueDates(
        {
          frequency: "BIWEEKLY_ROLLING",
          dueDay: null,
          secondDueDay: null,
          weekday: null,
          anchorDate: new Date(Date.UTC(2026, 8, 11)),
        },
        2026,
        9,
      );
      expect(isoDates(dates)).toEqual(["2026-09-11", "2026-09-25"]);
    });

    it("keeps rolling correctly into a later month, not resetting to the anchor's day", () => {
      const anchorDate = new Date(Date.UTC(2026, 8, 11));
      const dates = computeFixedCostDueDates(
        { frequency: "BIWEEKLY_ROLLING", dueDay: null, secondDueDay: null, weekday: null, anchorDate },
        2026,
        10,
      );
      // 25/09 + 14 = 09/10; 09/10 + 14 = 23/10.
      expect(isoDates(dates)).toEqual(["2026-10-09", "2026-10-23"]);
    });

    it("also rolls backward from the anchor for earlier months", () => {
      // A cadência vale nos dois sentidos: se a âncora é 11/09, o ciclo de 14
      // em 14 dias também reconstrói as datas anteriores (28/08, 14/08...).
      const anchorDate = new Date(Date.UTC(2026, 8, 11));
      const dates = computeFixedCostDueDates(
        { frequency: "BIWEEKLY_ROLLING", dueDay: null, secondDueDay: null, weekday: null, anchorDate },
        2026,
        8,
      );
      expect(isoDates(dates)).toEqual(["2026-08-14", "2026-08-28"]);
    });

    it("returns an empty array when anchorDate is missing", () => {
      expect(
        computeFixedCostDueDates(
          { frequency: "BIWEEKLY_ROLLING", dueDay: null, secondDueDay: null, weekday: null, anchorDate: null },
          2026,
          9,
        ),
      ).toEqual([]);
    });
  });
});

describe("computeFixedCostMonthlyAmount", () => {
  it("returns the raw amount once for a monthly cost", () => {
    const total = computeFixedCostMonthlyAmount(
      { frequency: "MONTHLY", dueDay: 5, secondDueDay: null, weekday: null, anchorDate: null, amount: 4000 },
      2026,
      8,
    );
    expect(total).toBe(4000);
  });

  it("multiplies by 4 occurrences for a weekly cost in a 4-Friday month", () => {
    // Agosto/2026 tem 4 sextas-feiras (bug real: um custo semanal de R$4.000
    // não custa R$4.000/mês, custa 4x isso).
    const total = computeFixedCostMonthlyAmount(
      { frequency: "WEEKLY", dueDay: null, secondDueDay: null, weekday: 5, anchorDate: null, amount: 4000 },
      2026,
      8,
    );
    expect(total).toBe(16000);
  });

  it("multiplies by 5 occurrences for a weekly cost in a 5-Friday month", () => {
    const total = computeFixedCostMonthlyAmount(
      { frequency: "WEEKLY", dueDay: null, secondDueDay: null, weekday: 5, anchorDate: null, amount: 4000 },
      2026,
      7,
    );
    expect(total).toBe(20000);
  });

  it("doubles the amount for a biweekly cost", () => {
    const total = computeFixedCostMonthlyAmount(
      { frequency: "BIWEEKLY", dueDay: 5, secondDueDay: 20, weekday: null, anchorDate: null, amount: 1000 },
      2026,
      8,
    );
    expect(total).toBe(2000);
  });

  it("counts 2 occurrences for a rolling biweekly cost in a normal month", () => {
    const total = computeFixedCostMonthlyAmount(
      {
        frequency: "BIWEEKLY_ROLLING",
        dueDay: null,
        secondDueDay: null,
        weekday: null,
        anchorDate: new Date(Date.UTC(2026, 8, 11)),
        amount: 750,
      },
      2026,
      9,
    );
    expect(total).toBe(1500);
  });
});
