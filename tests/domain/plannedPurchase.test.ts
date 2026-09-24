import { describe, it, expect } from "vitest";
import {
  addMonthsUTC,
  plannedPurchaseMovements,
  splitInstallments,
  suggestPurchase,
} from "@/domain/plannedPurchase";
import type { CogsResult } from "@/domain/cogs";

function utc(y: number, m: number, d: number) {
  return new Date(Date.UTC(y, m - 1, d));
}

describe("addMonthsUTC", () => {
  it("não estoura o fim do mês", () => {
    expect(addMonthsUTC(utc(2026, 1, 31), 1)).toEqual(utc(2026, 2, 28));
  });

  it("vira o ano", () => {
    expect(addMonthsUTC(utc(2026, 11, 10), 2)).toEqual(utc(2027, 1, 10));
  });
});

describe("splitInstallments", () => {
  it("divide sem perder centavos", () => {
    const parts = splitInstallments(100, 3);
    expect(parts).toEqual([33.33, 33.33, 33.34]);
    expect(parts.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 2);
  });

  it("uma parcela devolve o total", () => {
    expect(splitInstallments(4500, 1)).toEqual([4500]);
  });
});

describe("plannedPurchaseMovements", () => {
  const today = utc(2026, 9, 24);
  const end = utc(2026, 10, 24);

  it("gera saídas simuladas marcadas como planejadas, uma por parcela dentro da janela", () => {
    const m = plannedPurchaseMovements(
      [{ kind: "MATERIAL", label: "Aviamentos", amount: 300, dueDate: utc(2026, 10, 10), installments: 3 }],
      today,
      end,
    );
    // parcelas em 10/10, 10/11, 10/12: só a primeira cabe em 30 dias
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ date: utc(2026, 10, 10), amount: -100, planned: true });
    expect(m[0].label).toContain("planejado 1/3");
  });

  it("costura é sempre uma saída só, mesmo com installments > 1", () => {
    const m = plannedPurchaseMovements(
      [{ kind: "COSTURA", label: "Costura estimada", amount: 7400, dueDate: utc(2026, 10, 20), installments: 3 }],
      today,
      end,
    );
    expect(m).toHaveLength(1);
    expect(m[0].amount).toBe(-7400);
  });

  it("data passada cai em hoje", () => {
    const m = plannedPurchaseMovements(
      [{ kind: "MATERIAL", label: "Tecido", amount: 50, dueDate: utc(2026, 9, 1), installments: 1 }],
      today,
      end,
    );
    expect(m[0].date).toEqual(today);
  });

  it("ignora o que cai fora da janela", () => {
    const m = plannedPurchaseMovements(
      [{ kind: "MATERIAL", label: "Tecido", amount: 50, dueDate: utc(2026, 12, 1), installments: 1 }],
      today,
      end,
    );
    expect(m).toEqual([]);
  });
});

describe("suggestPurchase", () => {
  const base: CogsResult = {
    tecido: 1000,
    costura: 400,
    aviamentos: 200,
    matchedSkus: 3,
    unmatchedSkus: 0,
    matchedQuantity: 30,
    totalQuantity: 30,
    coveragePercent: 100,
  };

  it("calcula quanto de costura cada R$ 1 de tecido gera", () => {
    expect(suggestPurchase(base, 80)?.costuraPerTecido).toBeCloseTo(0.4);
  });

  it("sem custo cadastrado devolve null", () => {
    expect(suggestPurchase({ ...base, tecido: 0, aviamentos: 0 }, 80)).toBeNull();
  });

  it("marca cobertura baixa", () => {
    expect(suggestPurchase({ ...base, coveragePercent: 50 }, 80)?.lowCoverage).toBe(true);
  });

  it("sem tecido, costuraPerTecido é null (não divide por zero)", () => {
    expect(suggestPurchase({ ...base, tecido: 0 }, 80)?.costuraPerTecido).toBeNull();
  });
});
