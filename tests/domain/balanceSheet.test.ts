import { describe, it, expect } from "vitest";
import { computeBalanceSheet } from "@/domain/balanceSheet";

describe("computeBalanceSheet", () => {
  it("sums lines per section and totals ativo/passivo", () => {
    const report = computeBalanceSheet({
      ativoCirculante: [
        { label: "Caixa", amount: 10000 },
        { label: "A receber", amount: 5000 },
      ],
      ativoNaoCirculante: [{ label: "Máquinas", amount: 8000 }],
      passivoCirculante: [{ label: "A pagar", amount: 3000 }],
      passivoNaoCirculante: [{ label: "Empréstimo", amount: 6000 }],
      patrimonioLiquidoManual: [],
    });

    expect(report.ativoCirculante.total).toBe(15000);
    expect(report.ativoNaoCirculante.total).toBe(8000);
    expect(report.ativoTotal).toBe(23000);
    expect(report.passivoCirculante.total).toBe(3000);
    expect(report.passivoNaoCirculante.total).toBe(6000);
    expect(report.passivoTotal).toBe(9000);
  });

  it("computes patrimonio liquido as ativo total minus passivo total", () => {
    const report = computeBalanceSheet({
      ativoCirculante: [{ label: "Caixa", amount: 20000 }],
      ativoNaoCirculante: [],
      passivoCirculante: [{ label: "A pagar", amount: 5000 }],
      passivoNaoCirculante: [],
      patrimonioLiquidoManual: [],
    });

    expect(report.patrimonioLiquido).toBe(15000);
  });

  it("splits patrimonio liquido into capital social and lucros acumulados", () => {
    const report = computeBalanceSheet({
      ativoCirculante: [{ label: "Caixa", amount: 30000 }],
      ativoNaoCirculante: [],
      passivoCirculante: [],
      passivoNaoCirculante: [],
      patrimonioLiquidoManual: [{ label: "Capital Social", amount: 20000 }],
    });

    expect(report.patrimonioLiquido).toBe(30000);
    expect(report.capitalSocial).toBe(20000);
    expect(report.lucrosAcumulados).toBe(10000);
  });

  it("allows negative lucros acumulados (prejuízo acumulado)", () => {
    const report = computeBalanceSheet({
      ativoCirculante: [{ label: "Caixa", amount: 5000 }],
      ativoNaoCirculante: [],
      passivoCirculante: [{ label: "A pagar", amount: 8000 }],
      passivoNaoCirculante: [],
      patrimonioLiquidoManual: [{ label: "Capital Social", amount: 10000 }],
    });

    expect(report.patrimonioLiquido).toBe(-3000);
    expect(report.lucrosAcumulados).toBe(-13000);
  });

  it("returns zero totals for empty sections", () => {
    const report = computeBalanceSheet({
      ativoCirculante: [],
      ativoNaoCirculante: [],
      passivoCirculante: [],
      passivoNaoCirculante: [],
      patrimonioLiquidoManual: [],
    });

    expect(report.ativoTotal).toBe(0);
    expect(report.passivoTotal).toBe(0);
    expect(report.patrimonioLiquido).toBe(0);
  });
});
