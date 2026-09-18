import { describe, it, expect, vi, afterEach } from "vitest";
import { todayUTCInBrazil } from "@/lib/today";

afterEach(() => {
  vi.useRealTimers();
});

describe("todayUTCInBrazil", () => {
  it("stays on the previous day for the first 3 hours after UTC midnight (still evening in Brazil)", () => {
    // 2026-09-18T00:27 UTC = 2026-09-17T21:27 em Brasília (UTC-3) — ainda 17/09.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-18T00:27:00.000Z"));
    expect(todayUTCInBrazil().toISOString()).toBe("2026-09-17T00:00:00.000Z");
  });

  it("rolls over once it's actually past midnight in Brazil", () => {
    // 2026-09-18T03:01 UTC = 2026-09-18T00:01 em Brasília — já é 18/09.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-18T03:01:00.000Z"));
    expect(todayUTCInBrazil().toISOString()).toBe("2026-09-18T00:00:00.000Z");
  });

  it("matches the calendar date mid-afternoon, with no ambiguity", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-18T15:00:00.000Z"));
    expect(todayUTCInBrazil().toISOString()).toBe("2026-09-18T00:00:00.000Z");
  });
});
