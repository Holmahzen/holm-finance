import { describe, expect, it } from "vitest";
import { computeMonthlyCommitment } from "@/domain/creditCardCommitment";

describe("computeMonthlyCommitment", () => {
  it("agrupa parcelas por mês de vencimento", () => {
    const result = computeMonthlyCommitment(
      [
        { amount: 100, dueDate: new Date(Date.UTC(2026, 7, 10)) },
        { amount: 50, dueDate: new Date(Date.UTC(2026, 7, 20)) },
        { amount: 200, dueDate: new Date(Date.UTC(2026, 8, 5)) },
      ],
      2026,
      8,
      3,
    );
    expect(result).toEqual([
      { year: 2026, month: 8, committed: 150 },
      { year: 2026, month: 9, committed: 200 },
      { year: 2026, month: 10, committed: 0 },
    ]);
  });

  it("vira o ano quando o intervalo passa de dezembro", () => {
    const result = computeMonthlyCommitment(
      [{ amount: 80, dueDate: new Date(Date.UTC(2027, 0, 15)) }],
      2026,
      11,
      3,
    );
    expect(result).toEqual([
      { year: 2026, month: 11, committed: 0 },
      { year: 2026, month: 12, committed: 0 },
      { year: 2027, month: 1, committed: 80 },
    ]);
  });

  it("ignora parcelas fora da janela de meses", () => {
    const result = computeMonthlyCommitment(
      [{ amount: 999, dueDate: new Date(Date.UTC(2030, 0, 1)) }],
      2026,
      8,
      2,
    );
    expect(result.reduce((s, m) => s + m.committed, 0)).toBe(0);
  });

  it("retorna array vazio quando monthsAhead é 0", () => {
    expect(computeMonthlyCommitment([], 2026, 8, 0)).toEqual([]);
  });
});
