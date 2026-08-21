import { describe, expect, it } from "vitest";
import {
  computeThirteenthProvision,
  computeVacationProvision,
  computeContingencyTarget,
  computeTaxEstimate,
  computeTaxDueDate,
  computeDaysUntil,
  computeDaysRemainingInMonth,
  computeDailyGoal,
  computeReserveAlerts,
} from "@/domain/cashReserve";

describe("computeThirteenthProvision", () => {
  it("meta do ano é igual à folha mensal", () => {
    const result = computeThirteenthProvision(12000, 6);
    expect(result.yearTarget).toBe(12000);
    expect(result.monthlyAccrual).toBe(1000);
    expect(result.accruedSoFar).toBe(6000);
    expect(result.remainingThisYear).toBe(6000);
  });

  it("em dezembro (12 meses decorridos) o acumulado bate com a meta", () => {
    const result = computeThirteenthProvision(12000, 12);
    expect(result.accruedSoFar).toBe(12000);
    expect(result.remainingThisYear).toBe(0);
  });

  it("zero salários dá zero em tudo", () => {
    const result = computeThirteenthProvision(0, 8);
    expect(result).toEqual({ yearTarget: 0, monthlyAccrual: 0, accruedSoFar: 0, remainingThisYear: 0 });
  });
});

describe("computeVacationProvision", () => {
  it("meta do ano é a folha mensal + 1/3", () => {
    const result = computeVacationProvision(12000, 6);
    expect(result.yearTarget).toBeCloseTo(16000, 5);
    expect(result.monthlyAccrual).toBeCloseTo(16000 / 12, 5);
    expect(result.accruedSoFar).toBeCloseTo((16000 / 12) * 6, 5);
  });
});

describe("computeContingencyTarget", () => {
  it("multiplica o custo fixo mensal pelos meses de cobertura", () => {
    expect(computeContingencyTarget(20000, 3)).toBe(60000);
    expect(computeContingencyTarget(20000, 0)).toBe(0);
  });
});

describe("computeTaxEstimate", () => {
  it("aplica a alíquota sobre o faturamento do mês", () => {
    expect(computeTaxEstimate(20000, 14)).toBeCloseTo(2800, 5);
  });

  it("zero faturamento dá zero imposto", () => {
    expect(computeTaxEstimate(0, 14)).toBe(0);
  });

  it("zero alíquota dá zero imposto mesmo com faturamento", () => {
    expect(computeTaxEstimate(20000, 0)).toBe(0);
  });
});

describe("computeTaxDueDate", () => {
  it("vence no dia informado do mês seguinte ao de referência", () => {
    const due = computeTaxDueDate(2026, 8, 20);
    expect(due.getFullYear()).toBe(2026);
    expect(due.getMonth()).toBe(8); // setembro (0-indexado)
    expect(due.getDate()).toBe(20);
  });

  it("vira o ano quando o mês de referência é dezembro", () => {
    const due = computeTaxDueDate(2026, 12, 20);
    expect(due.getFullYear()).toBe(2027);
    expect(due.getMonth()).toBe(0); // janeiro
    expect(due.getDate()).toBe(20);
  });
});

describe("computeDaysUntil", () => {
  it("conta os dias corridos até o vencimento", () => {
    const from = new Date(2026, 7, 10);
    const due = new Date(2026, 8, 20);
    expect(computeDaysUntil(due, from)).toBe(41);
  });

  it("retorna 0 no próprio dia do vencimento", () => {
    const day = new Date(2026, 8, 20);
    expect(computeDaysUntil(day, day)).toBe(0);
  });

  it("retorna negativo se já venceu", () => {
    const from = new Date(2026, 8, 25);
    const due = new Date(2026, 8, 20);
    expect(computeDaysUntil(due, from)).toBe(-5);
  });
});

describe("computeDaysRemainingInMonth", () => {
  it("conta hoje como um dos dias restantes", () => {
    // agosto/2026 tem 31 dias
    expect(computeDaysRemainingInMonth(2026, 8, 31)).toBe(1);
    expect(computeDaysRemainingInMonth(2026, 8, 1)).toBe(31);
    expect(computeDaysRemainingInMonth(2026, 8, 12)).toBe(20);
  });

  it("nunca retorna menos que 1", () => {
    expect(computeDaysRemainingInMonth(2026, 8, 31)).toBeGreaterThanOrEqual(1);
  });
});

describe("computeDailyGoal", () => {
  it("divide a meta mensal pelos dias restantes", () => {
    expect(computeDailyGoal(3100, 20)).toBe(155);
  });

  it("zero meta dá zero meta diária", () => {
    expect(computeDailyGoal(0, 20)).toBe(0);
  });
});

describe("computeReserveAlerts", () => {
  const okInput = {
    tax: { daysUntilDue: 30, target: 1000, saved: 1000 },
    contingency: { target: 10000, saved: 5000 },
    thirteenth: { accruedSoFar: 1000, saved: 1000 },
    vacation: { accruedSoFar: 1000, saved: 1000 },
  };

  it("returns no alerts when everything is well-funded", () => {
    expect(computeReserveAlerts(okInput)).toEqual([]);
  });

  it("warns about tax due within 15 days but not yet fully saved", () => {
    const alerts = computeReserveAlerts({
      ...okInput,
      tax: { daysUntilDue: 10, target: 1000, saved: 400 },
    });
    expect(alerts).toEqual([
      { type: "tax_due_soon_underfunded", severity: "warning", daysUntilDue: 10, target: 1000, saved: 400 },
    ]);
  });

  it("escalates to critical when tax is due within 5 days and underfunded", () => {
    const alerts = computeReserveAlerts({
      ...okInput,
      tax: { daysUntilDue: 3, target: 1000, saved: 0 },
    });
    expect(alerts[0]).toMatchObject({ type: "tax_due_soon_underfunded", severity: "critical" });
  });

  it("does not alert on tax that is already fully saved, regardless of due date", () => {
    const alerts = computeReserveAlerts({
      ...okInput,
      tax: { daysUntilDue: 1, target: 1000, saved: 1000 },
    });
    expect(alerts).toEqual([]);
  });

  it("does not alert on tax due far in the future even if underfunded", () => {
    const alerts = computeReserveAlerts({
      ...okInput,
      tax: { daysUntilDue: 20, target: 1000, saved: 0 },
    });
    expect(alerts).toEqual([]);
  });

  it("warns when contingency reserve is below 10% of target", () => {
    const alerts = computeReserveAlerts({
      ...okInput,
      contingency: { target: 10000, saved: 500 },
    });
    expect(alerts).toEqual([
      { type: "contingency_low", severity: "warning", target: 10000, saved: 500 },
    ]);
  });

  it("warns when a provision has saved less than half of what's accrued so far", () => {
    const alerts = computeReserveAlerts({
      ...okInput,
      thirteenth: { accruedSoFar: 1000, saved: 200 },
    });
    expect(alerts).toEqual([
      { type: "provision_behind_pace", severity: "warning", category: "thirteenth", accruedSoFar: 1000, saved: 200 },
    ]);
  });

  it("can report multiple alerts at once", () => {
    const alerts = computeReserveAlerts({
      tax: { daysUntilDue: 2, target: 1000, saved: 0 },
      contingency: { target: 10000, saved: 0 },
      thirteenth: { accruedSoFar: 1000, saved: 0 },
      vacation: { accruedSoFar: 1000, saved: 0 },
    });
    expect(alerts).toHaveLength(4);
  });
});
