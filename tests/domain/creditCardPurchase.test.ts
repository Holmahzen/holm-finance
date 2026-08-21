import { describe, expect, it } from "vitest";
import { computeInstallments } from "@/domain/creditCardPurchase";
import { DomainError } from "@/domain/errors";

describe("computeInstallments", () => {
  it("divide o valor em parcelas iguais quando é exato", () => {
    const result = computeInstallments(300, 3, new Date(Date.UTC(2026, 7, 5)));
    expect(result).toHaveLength(3);
    expect(result.map((i) => i.amount)).toEqual([100, 100, 100]);
    expect(result.map((i) => i.installmentNumber)).toEqual([1, 2, 3]);
  });

  it("joga o resto do arredondamento na última parcela", () => {
    const result = computeInstallments(100, 3, new Date(Date.UTC(2026, 7, 5)));
    expect(result.map((i) => i.amount)).toEqual([33.33, 33.33, 33.34]);
    const sum = result.reduce((s, i) => s + i.amount, 0);
    expect(Math.round(sum * 100) / 100).toBe(100);
  });

  it("repete o dia do vencimento nos meses seguintes", () => {
    const result = computeInstallments(300, 3, new Date(Date.UTC(2026, 7, 5)));
    expect(result.map((i) => i.dueDate.getUTCMonth())).toEqual([7, 8, 9]);
    expect(result.every((i) => i.dueDate.getUTCDate() === 5)).toBe(true);
  });

  it("ajusta pro último dia real do mês (dia 31 em mês menor)", () => {
    const result = computeInstallments(200, 2, new Date(Date.UTC(2026, 0, 31)));
    expect(result[0].dueDate.getUTCDate()).toBe(31);
    expect(result[1].dueDate.getUTCMonth()).toBe(1);
    expect(result[1].dueDate.getUTCDate()).toBe(28);
  });

  it("vira o ano quando a parcela passa de dezembro", () => {
    const result = computeInstallments(200, 2, new Date(Date.UTC(2026, 11, 10)));
    expect(result[1].dueDate.getUTCFullYear()).toBe(2027);
    expect(result[1].dueDate.getUTCMonth()).toBe(0);
  });

  it("lança erro se parcelas for menor que 1", () => {
    expect(() => computeInstallments(100, 0, new Date())).toThrow(DomainError);
  });

  it("funciona com 1 parcela só", () => {
    const result = computeInstallments(150.5, 1, new Date(Date.UTC(2026, 7, 5)));
    expect(result).toEqual([
      { installmentNumber: 1, amount: 150.5, dueDate: new Date(Date.UTC(2026, 7, 5)) },
    ]);
  });
});
