import { describe, it, expect } from "vitest";
import { computeDre, type DreGroupTotals } from "@/domain/dre";

function line(categoryId: string, name: string, total: number) {
  return { categoryId, name, total };
}

describe("computeDre", () => {
  it("returns all zeros for an empty period", () => {
    const result = computeDre({});
    expect(result.receitaBruta.total).toBe(0);
    expect(result.receitaLiquida).toBe(0);
    expect(result.cmv.total).toBe(0);
    expect(result.custosVariaveisTotal).toBe(0);
    expect(result.margemContribuicao).toBe(0);
    expect(result.resultadoOperacional).toBe(0);
    expect(result.lucroLiquido).toBe(0);
  });

  it("computes the full waterfall exactly per the required formulas", () => {
    const byGroup: DreGroupTotals = {
      RECEITA_BRUTA: [line("c1", "Vendas ML", 10000), line("c2", "Vendas Shopee", 2000)],
      DEDUCOES_RECEITA: [line("c3", "DAS", 500)],
      CUSTO_MERCADORIA_VENDIDA: [line("c4", "Tecido", 3000)],
      CUSTO_VARIAVEL: [line("c5", "Flex", 700)],
      DESPESA_PESSOAL: [line("c6", "Salários", 2000)],
      DESPESA_ADMINISTRATIVA: [line("c7", "Aluguel", 1000)],
      DESPESA_COMERCIAL: [line("c8", "Publicidade", 300)],
      DESPESA_PRODUTIVA: [line("c9", "Energia", 200)],
      RESULTADO_FINANCEIRO_RECEITA: [line("c10", "Rendimentos", 50)],
      RESULTADO_FINANCEIRO_DESPESA: [line("c11", "Tarifas bancárias", 30)],
      NAO_OPERACIONAL_RECEITA: [line("c12", "Venda de máquina", 400)],
      NAO_OPERACIONAL_DESPESA: [line("c13", "Perda extraordinária", 100)],
    };

    const result = computeDre(byGroup);

    // 1-3
    expect(result.receitaBruta.total).toBe(12000);
    expect(result.deducoes.total).toBe(500);
    expect(result.receitaLiquida).toBe(11500); // 12000 - 500

    // 4-5
    expect(result.cmv.total).toBe(3000);
    expect(result.custoVariavel.total).toBe(700);
    expect(result.custosVariaveisTotal).toBe(3700); // 3000 + 700
    expect(result.margemContribuicao).toBe(7800); // 11500 - 3700

    // 6-7
    expect(result.despesasFixasTotal).toBe(3500); // 2000+1000+300+200
    expect(result.resultadoOperacional).toBe(4300); // 7800 - 3500

    // 8-9
    expect(result.resultadoFinanceiro).toBe(20); // 50 - 30
    expect(result.resultadoAntesImposto).toBe(4320); // 4300 + 20

    // 10-11
    expect(result.resultadoNaoOperacional).toBe(300); // 400 - 100
    expect(result.lucroLiquido).toBe(4620); // 4320 + 300
  });

  it("handles a loss (prejuízo) correctly", () => {
    const byGroup: DreGroupTotals = {
      RECEITA_BRUTA: [line("c1", "Vendas", 1000)],
      CUSTO_MERCADORIA_VENDIDA: [line("c2", "Tecido", 2000)],
    };
    const result = computeDre(byGroup);
    expect(result.margemContribuicao).toBe(-1000);
    expect(result.lucroLiquido).toBe(-1000);
  });

  it("preserves individual line items within each section", () => {
    const byGroup: DreGroupTotals = {
      CUSTO_MERCADORIA_VENDIDA: [line("c1", "Tecido", 100), line("c2", "Costura", 200)],
      CUSTO_VARIAVEL: [line("c3", "Comissão do Mercado Livre", 50)],
    };
    const result = computeDre(byGroup);
    expect(result.cmv.lines).toEqual([
      { categoryId: "c1", name: "Tecido", total: 100 },
      { categoryId: "c2", name: "Costura", total: 200 },
    ]);
    expect(result.custoVariavel.lines).toEqual([
      { categoryId: "c3", name: "Comissão do Mercado Livre", total: 50 },
    ]);
  });
});
