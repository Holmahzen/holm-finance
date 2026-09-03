import { describe, it, expect } from "vitest";
import {
  computeCashFlowProjection,
  findFirstNegativeDay,
  aggregateProjectionByWeek,
} from "@/domain/cashFlow";

const day = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe("computeCashFlowProjection", () => {
  it("carries the starting balance forward when there are no movements", () => {
    const projection = computeCashFlowProjection(1000, [], day(2026, 8, 1), 3);
    expect(projection).toHaveLength(3);
    expect(projection.map((d) => d.runningBalance)).toEqual([1000, 1000, 1000]);
  });

  it("applies inflow and outflow on the exact day they're due", () => {
    const movements = [
      { date: day(2026, 8, 1), amount: 500, label: "Recebimento" },
      { date: day(2026, 8, 2), amount: -300, label: "Aluguel" },
    ];
    const projection = computeCashFlowProjection(1000, movements, day(2026, 8, 1), 3);
    expect(projection[0]).toMatchObject({ inflow: 500, outflow: 0, netChange: 500, runningBalance: 1500 });
    expect(projection[1]).toMatchObject({ inflow: 0, outflow: 300, netChange: -300, runningBalance: 1200 });
    expect(projection[2]).toMatchObject({ inflow: 0, outflow: 0, netChange: 0, runningBalance: 1200 });
  });

  it("aggregates multiple movements on the same day", () => {
    const movements = [
      { date: day(2026, 8, 1), amount: 200, label: "A" },
      { date: day(2026, 8, 1), amount: 300, label: "B" },
      { date: day(2026, 8, 1), amount: -100, label: "C" },
    ];
    const projection = computeCashFlowProjection(0, movements, day(2026, 8, 1), 1);
    expect(projection[0]).toMatchObject({ inflow: 500, outflow: 100, netChange: 400, runningBalance: 400 });
    expect(projection[0].movements).toHaveLength(3);
  });

  it("ignores movements outside the projected window", () => {
    const movements = [{ date: day(2026, 9, 1), amount: -1000, label: "Fora da janela" }];
    const projection = computeCashFlowProjection(500, movements, day(2026, 8, 1), 5);
    expect(projection.every((d) => d.runningBalance === 500)).toBe(true);
  });

  it("keeps the running balance cumulative across days", () => {
    const movements = [
      { date: day(2026, 8, 1), amount: -100, label: "A" },
      { date: day(2026, 8, 3), amount: -100, label: "B" },
    ];
    const projection = computeCashFlowProjection(300, movements, day(2026, 8, 1), 4);
    expect(projection.map((d) => d.runningBalance)).toEqual([200, 200, 100, 100]);
  });
});

describe("findFirstNegativeDay", () => {
  it("returns the first day the balance dips below zero", () => {
    const movements = [
      { date: day(2026, 8, 2), amount: -500, label: "Saída grande" },
    ];
    const projection = computeCashFlowProjection(300, movements, day(2026, 8, 1), 3);
    const negative = findFirstNegativeDay(projection);
    expect(negative?.date).toEqual(day(2026, 8, 2));
    expect(negative?.runningBalance).toBe(-200);
  });

  it("returns null when the balance never goes negative", () => {
    const projection = computeCashFlowProjection(1000, [], day(2026, 8, 1), 5);
    expect(findFirstNegativeDay(projection)).toBeNull();
  });
});

describe("aggregateProjectionByWeek", () => {
  it("groups 14 days into 2 buckets of 7", () => {
    const projection = computeCashFlowProjection(1000, [], day(2026, 8, 1), 14);
    const buckets = aggregateProjectionByWeek(projection);
    expect(buckets).toHaveLength(2);
    expect(buckets[0].days).toBe(7);
    expect(buckets[1].days).toBe(7);
  });

  it("makes the last bucket smaller when the total isn't a multiple of the week length", () => {
    const projection = computeCashFlowProjection(1000, [], day(2026, 8, 1), 10);
    const buckets = aggregateProjectionByWeek(projection);
    expect(buckets).toHaveLength(2);
    expect(buckets[0].days).toBe(7);
    expect(buckets[1].days).toBe(3);
  });

  it("sums inflow/outflow within each bucket and uses the last day's runningBalance as endingBalance", () => {
    const movements = [
      { date: day(2026, 8, 1), amount: 500, label: "A" },
      { date: day(2026, 8, 3), amount: -200, label: "B" },
      { date: day(2026, 8, 9), amount: 100, label: "C" },
    ];
    const projection = computeCashFlowProjection(0, movements, day(2026, 8, 1), 14);
    const buckets = aggregateProjectionByWeek(projection);

    expect(buckets[0].inflow).toBe(500);
    expect(buckets[0].outflow).toBe(200);
    expect(buckets[0].netChange).toBe(300);
    expect(buckets[0].endingBalance).toBe(projection[6].runningBalance);

    expect(buckets[1].inflow).toBe(100);
    expect(buckets[1].endingBalance).toBe(projection[13].runningBalance);
  });

  it("supports a custom bucket length", () => {
    const projection = computeCashFlowProjection(1000, [], day(2026, 8, 1), 9);
    const buckets = aggregateProjectionByWeek(projection, 3);
    expect(buckets).toHaveLength(3);
    expect(buckets.every((b) => b.days === 3)).toBe(true);
  });

  it("returns an empty array for an empty projection", () => {
    expect(aggregateProjectionByWeek([])).toEqual([]);
  });
});
