import { describe, it, expect } from "vitest";
import {
  computePriceAmortization,
  splitInstallment,
  computeLoanInterestForPeriod,
  computeOutstandingPrincipal,
} from "@/domain/loanAmortization";

describe("computePriceAmortization", () => {
  it("computes a fixed payment matching the Sicredi loan (R$200k, 1.89%, 48x)", () => {
    const schedule = computePriceAmortization(200000, 1.89, 48);
    expect(schedule).toHaveLength(48);
    expect(schedule[0].payment).toBeCloseTo(6375.28, 1);
  });

  it("computes exact interest on the first installment as balance × rate", () => {
    const schedule = computePriceAmortization(200000, 1.89, 48);
    expect(schedule[0].interest).toBeCloseTo(200000 * 0.0189, 2); // 3780.00
    expect(schedule[0].principal).toBeCloseTo(schedule[0].payment - schedule[0].interest, 6);
  });

  it("decreases interest and increases principal portion over time", () => {
    const schedule = computePriceAmortization(200000, 1.89, 48);
    expect(schedule[10].interest).toBeLessThan(schedule[0].interest);
    expect(schedule[10].principal).toBeGreaterThan(schedule[0].principal);
  });

  it("pays off the balance exactly by the last installment", () => {
    const schedule = computePriceAmortization(200000, 1.89, 48);
    expect(schedule[47].balance).toBeCloseTo(0, 2);
  });

  it("keeps every payment the same fixed amount", () => {
    const schedule = computePriceAmortization(50000, 2, 12);
    const payments = new Set(schedule.map((s) => Math.round(s.payment * 100)));
    expect(payments.size).toBe(1);
  });

  it("supports a 0% rate as pure equal-split principal", () => {
    const schedule = computePriceAmortization(1200, 0, 12);
    expect(schedule[0].payment).toBeCloseTo(100);
    expect(schedule[0].interest).toBe(0);
    expect(schedule[11].balance).toBeCloseTo(0, 6);
  });
});

describe("splitInstallment", () => {
  it("splits a known payment into interest and principal given the outstanding balance", () => {
    const result = splitInstallment(200000, 1.89, 6375.28);
    expect(result.interest).toBeCloseTo(3780, 2);
    expect(result.principal).toBeCloseTo(2595.28, 2);
    expect(result.newBalance).toBeCloseTo(197404.72, 2);
  });
});

describe("computeLoanInterestForPeriod", () => {
  const loan = { principal: 200000, monthlyRatePercent: 1.89, installments: 48 };

  it("matches the real Sicredi installments 1 and 2 paid in June", () => {
    const payments = [
      { id: "p1", paidAmount: 6375.28, paidAt: new Date("2026-06-01") },
      { id: "p2", paidAmount: 6375.28, paidAt: new Date("2026-06-30") },
    ];
    const result = computeLoanInterestForPeriod(
      loan,
      payments,
      new Date("2026-06-01"),
      new Date("2026-07-01"),
    );
    expect(result.matchedCount).toBe(2);
    expect(result.cashPaidInPeriod).toBeCloseTo(12750.56, 2);
    expect(result.interestInPeriod).toBeCloseTo(3780 + 3730.9491973168724, 2);
  });

  it("only counts payments that fall inside the period, using their position in the full history", () => {
    const payments = [
      { id: "p1", paidAmount: 6375.28, paidAt: new Date("2026-06-01") }, // installment 1
      { id: "p2", paidAmount: 6375.28, paidAt: new Date("2026-06-30") }, // installment 2
      { id: "p3", paidAmount: 6375.28, paidAt: new Date("2026-07-30") }, // installment 3
    ];
    const julyOnly = computeLoanInterestForPeriod(
      loan,
      payments,
      new Date("2026-07-01"),
      new Date("2026-08-01"),
    );
    expect(julyOnly.matchedCount).toBe(1);
    const fullSchedule = computePriceAmortization(200000, 1.89, 48);
    expect(julyOnly.interestInPeriod).toBeCloseTo(fullSchedule[2].interest, 2);
  });

  it("returns zeros when no payments fall in the period", () => {
    const result = computeLoanInterestForPeriod(loan, [], new Date("2026-01-01"), new Date("2026-02-01"));
    expect(result).toEqual({ cashPaidInPeriod: 0, interestInPeriod: 0, principalInPeriod: 0, matchedCount: 0 });
  });

  it("falls back to treating the payment as full interest beyond the known installment count", () => {
    const shortLoan = { principal: 1000, monthlyRatePercent: 1, installments: 1 };
    const payments = [
      { id: "p1", paidAmount: 1000, paidAt: new Date("2026-01-01") },
      { id: "p2", paidAmount: 500, paidAt: new Date("2026-02-01") }, // beyond the loan's term
    ];
    const result = computeLoanInterestForPeriod(
      shortLoan,
      payments,
      new Date("2026-02-01"),
      new Date("2026-03-01"),
    );
    expect(result.matchedCount).toBe(1);
    expect(result.interestInPeriod).toBeCloseTo(500, 2);
  });
});

describe("computeOutstandingPrincipal", () => {
  const loan = { principal: 200000, monthlyRatePercent: 1.89, installments: 48 };

  it("returns the full principal when no installments have been paid yet", () => {
    expect(computeOutstandingPrincipal(loan, 0)).toBe(200000);
  });

  it("matches the schedule's balance after a given number of paid installments", () => {
    const schedule = computePriceAmortization(200000, 1.89, 48);
    expect(computeOutstandingPrincipal(loan, 10)).toBeCloseTo(schedule[9].balance, 6);
  });

  it("returns zero once every installment has been paid", () => {
    expect(computeOutstandingPrincipal(loan, 48)).toBeCloseTo(0, 2);
  });

  it("clamps to the last installment's balance if paid count exceeds the schedule", () => {
    expect(computeOutstandingPrincipal(loan, 100)).toBeCloseTo(0, 2);
  });
});
