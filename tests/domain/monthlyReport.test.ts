import { describe, it, expect } from "vitest";
import { computeAverageTicket } from "@/domain/monthlyReport";

describe("computeAverageTicket", () => {
  it("divides gross revenue by sales count", () => {
    expect(computeAverageTicket(5000, 25)).toBe(200);
  });

  it("returns null when there are no sales", () => {
    expect(computeAverageTicket(5000, 0)).toBeNull();
  });
});
