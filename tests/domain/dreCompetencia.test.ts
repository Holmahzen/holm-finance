import { describe, it, expect } from "vitest";
import { computeDre, type DreGroupTotals } from "@/domain/dre";
import { buildCompetenceDre, type CompetenceInput } from "@/domain/dreCompetencia";

const line = (id: string, name: string, total: number) => ({ categoryId: id, name, total });

/** DRE de caixa de um mês parecido com agosto/2026 (valores redondos). */
function cash(overrides: DreGroupTotals = {}) {
  return computeDre({
    RECEITA_BRUTA: [line("r1", "Receita Venda ML", 190000)],
    DEDUCOES_RECEITA: [line("d1", "DAS", 45000)],
    CUSTO_MERCADORIA_VENDIDA: [line("c1", "Tecido (peças vendidas)", 43000), line("c2", "Costura (peças vendidas)", 42000)],
    CUSTO_VARIAVEL: [line("v1", "Flex", 11000), line("v2", "Faturamento ML", 5500), line("v3", "Mercadoria Revenda", 200)],
    DESPESA_PESSOAL: [line("p1", "Salarios", 26000)],
    DESPESA_ADMINISTRATIVA: [line("a1", "Aluguel", 6700)],
    DESPESA_COMERCIAL: [line("m1", "Marketing", 1350)],
    DESPESA_PRODUTIVA: [line("l1", "Luz", 200)],
    RESULTADO_FINANCEIRO_DESPESA: [line("f1", "Juros", 300)],
    ...overrides,
  });
}

function input(overrides: Partial<CompetenceInput> = {}): CompetenceInput {
  return {
    month: "2026-08",
    sales: { grossSales: 490000, returns: 11000, saleNotes: 7000 },
    pgdas: { revenue: 481946.66, das: 63904.94 },
    latestDasRate: { rate: 0.1326, period: "2026-08" },
    services: {
      total: 79653.88,
      count: 14,
      byCategory: [
        { key: "EBAZAR", label: "Ebazar (tarifas etc.)", value: 71441.36 },
        { key: "MERCADO_PAGO", label: "Mercado Pago", value: 4734.73 },
        { key: "FRETE", label: "Frete (envios)", value: 3477.79 },
      ],
    },
    cash: cash(),
    cmvFromSoldPieces: true,
    soldGrossRevenue: 470000,
    ...overrides,
  };
}

describe("buildCompetenceDre", () => {
  it("usa notas, extrato e notas de serviço, sem contar tarifa nem DAS duas vezes", () => {
    const dre = buildCompetenceDre(input());
    expect(dre).toMatchObject({
      available: true,
      revenueSource: "notas",
      receitaBruta: 490000,
      devolucoes: 11000,
      das: 63904.94,
      dasSource: "pgdas",
      cmv: 85000,
      tarifas: 79653.88,
      outrosVariaveis: 200, // Flex e Faturamento ML saem: as notas de serviço já cobrem
      despesasFixas: 34250,
      resultadoFinanceiro: -300,
    });
    expect(dre.receitaLiquida).toBeCloseTo(490000 - 11000 - 63904.94, 2);
    expect(dre.margemContribuicao).toBeCloseTo(dre.receitaLiquida - 85000 - 79653.88 - 200, 2);
    expect(dre.resultado).toBeCloseTo(dre.margemContribuicao - 34250 - 300, 2);
    expect(dre.replaced.map((r) => r.name)).toEqual([
      "Receitas recebidas no banco",
      "DAS pago no mês (lançamentos)",
      "Flex",
      "Faturamento ML",
    ]);
    expect(dre.conferencia).toEqual({ notasLiquidas: 479000, pgdas: 481946.66, diferenca: 479000 - 481946.66 });
  });

  it("sem notas de venda, usa a receita do PGDAS e não desconta devoluções de novo", () => {
    const dre = buildCompetenceDre(input({ sales: null }));
    expect(dre).toMatchObject({ revenueSource: "pgdas", receitaBruta: 481946.66, devolucoes: 0, conferencia: null });
    expect(dre.lines.find((l) => l.key === "devolucoes")?.note).toContain("Já descontadas");
  });

  it("sem extrato do mês, estima o DAS pela alíquota do extrato mais recente", () => {
    const dre = buildCompetenceDre(input({ month: "2026-09", pgdas: null }));
    expect(dre.dasSource).toBe("estimado");
    expect(dre.das).toBeCloseTo((490000 - 11000) * 0.1326, 2);
    expect(dre.warnings.some((w) => w.includes("estimado"))).toBe(true);
  });

  it("sem notas de serviço, mantém Flex e Faturamento ML dos lançamentos e avisa", () => {
    const dre = buildCompetenceDre(input({ services: null }));
    expect(dre.tarifas).toBe(0);
    expect(dre.outrosVariaveis).toBe(16700);
    expect(dre.replaced.map((r) => r.name)).not.toContain("Flex");
    expect(dre.warnings.some((w) => w.includes("subestimadas"))).toBe(true);
  });

  it("só a nota da transportadora substitui o Flex, e mantém o lançamento das tarifas do ML", () => {
    const dre = buildCompetenceDre(
      input({ services: { total: 3477.79, count: 2, byCategory: [{ key: "FRETE", label: "Frete (envios)", value: 3477.79 }] } }),
    );
    expect(dre.tarifas).toBe(3477.79);
    expect(dre.outrosVariaveis).toBe(5700); // Faturamento ML 5.500 + Mercadoria Revenda 200
    expect(dre.replaced.map((r) => r.name)).toContain("Flex");
    expect(dre.replaced.map((r) => r.name)).not.toContain("Faturamento ML");
    expect(dre.warnings.some((w) => w.includes("Faltam as notas de serviço do Ebazar"))).toBe(true);
    expect(buildCompetenceDre(input()).warnings.some((w) => w.includes("Ebazar"))).toBe(false);
  });

  it("tira o Mercado Ads e os demais itens da fatura do ML quando o mês tem as notas do Ebazar", () => {
    const base = cash({
      CUSTO_VARIAVEL: [
        line("v1", "Flex", 11000),
        line("v2", "Faturamento ML", 5500),
        line("v4", "Tarifas de venda dos marketplaces", 3137.7),
      ],
      DESPESA_COMERCIAL: [line("m1", "Marketing", 1350), line("m2", "Mercado Ads", 12724.13)],
    });
    const invoiceEntries = [
      { group: "DESPESA_COMERCIAL" as const, category: "Mercado Ads", description: "Fatura ML - Tarifas por campanha de publicidade (Ads)", amount: 12724.13 },
      { group: "CUSTO_VARIAVEL" as const, category: "Tarifas de venda dos marketplaces", description: "Fatura ML - Tarifas de envios Full", amount: 3090.93 },
      // A categoria "Faturamento ML" já sai inteira; não pode ser descontada de novo.
      { group: "CUSTO_VARIAVEL" as const, category: "Faturamento ML", description: "Fatura Mercado Livre (Ads/Coleta Full)", amount: 5500 },
    ];

    const dre = buildCompetenceDre(input({ cash: base, marketplaceInvoiceEntries: invoiceEntries }));
    expect(dre.lines.find((l) => l.key === "comercial")?.value).toBeCloseTo(-1350, 2);
    expect(dre.outrosVariaveis).toBeCloseTo(3137.7 - 3090.93, 2);
    expect(dre.replaced.map((r) => r.name)).toEqual(
      expect.arrayContaining(["Mercado Ads — Fatura ML - Tarifas por campanha de publicidade (Ads)", "Faturamento ML"]),
    );
    expect(dre.replaced.filter((r) => r.name.startsWith("Faturamento ML"))).toHaveLength(1);

    // Sem as notas do ML (só frete), os lançamentos da fatura ficam.
    const onlyFreight = buildCompetenceDre(
      input({
        cash: base,
        marketplaceInvoiceEntries: invoiceEntries,
        services: { total: 3477.79, count: 2, byCategory: [{ key: "FRETE", label: "Frete (envios)", value: 3477.79 }] },
      }),
    );
    expect(onlyFreight.lines.find((l) => l.key === "comercial")?.value).toBeCloseTo(-14074.13, 2);
  });

  it("avisa quando as vendas importadas passam as notas e quando há custo fixo fora do cadastro", () => {
    const dre = buildCompetenceDre(
      input({
        soldGrossRevenue: 539000,
        fixedCostGaps: [
          { kind: "faltando", category: "Pró-labore", expected: 4000, launched: 0, items: ["Pro Labore"] },
          { kind: "acima", category: "Salarios", expected: 20700, launched: 42000, items: ["Max"] },
        ],
      }),
    );
    expect(dre.warnings.some((w) => w.includes("13% acima das notas"))).toBe(true);
    const fixed = dre.warnings.find((w) => w.startsWith("Custos fixos cadastrados"));
    expect(fixed).toContain("sem lançamento ou abaixo do cadastro (Pró-labore)");
    expect(fixed).toContain("bem acima do cadastro (Salarios)");
    expect(dre.fixedCostGaps).toHaveLength(2);
    expect(buildCompetenceDre(input()).warnings.some((w) => w.includes("acima das notas"))).toBe(false);
  });

  it("sem notas nem extrato, não monta a competência e só guarda o resultado de caixa", () => {
    const dre = buildCompetenceDre(input({ sales: null, pgdas: null }));
    expect(dre).toMatchObject({ available: false, lines: [], resultado: 0 });
    expect(dre.cashResult).toBe(cash().lucroLiquido);
  });

  it("marca o mês sem custos lançados, para o resultado não parecer lucro", () => {
    expect(buildCompetenceDre(input()).hasCosts).toBe(true);
    const dre = buildCompetenceDre(input({ cash: computeDre({}) }));
    expect(dre.hasCosts).toBe(false);
    expect(dre.warnings[0]).toContain("poucos custos lançados (0,0% da receita)");

    // Custos de só R$ 4 mil num mês de R$ 490 mil também não contam como mês completo.
    const partial = buildCompetenceDre(
      input({ cash: computeDre({ CUSTO_VARIAVEL: [line("v1", "Mercadoria Revenda", 4000)] }), services: null }),
    );
    expect(partial.hasCosts).toBe(false);
  });

  it("leva o custo das peças à receita do mês quando o relatório de vendas está incompleto", () => {
    const dre = buildCompetenceDre(input({ soldGrossRevenue: 350000 }));
    expect(dre.cmv).toBeCloseTo(85000 * (479000 / 350000), 2);

    // Linhas pagas no mês (sem "peças vendidas") ficam como estão.
    const withPackaging = buildCompetenceDre(
      input({
        soldGrossRevenue: 350000,
        cash: cash({
          CUSTO_MERCADORIA_VENDIDA: [line("c1", "Tecido (peças vendidas)", 85000), line("c9", "Embalagens", 2500)],
        }),
      }),
    );
    expect(withPackaging.cmv).toBeCloseTo(85000 * (479000 / 350000) + 2500, 2);
    const cmvLine = dre.lines.find((l) => l.key === "cmv");
    expect(cmvLine?.source).toBe("estimado");
    expect(cmvLine?.note).toContain("73% da receita");
    expect(dre.replaced.map((r) => r.name)).toContain("Custo das peças das vendas importadas");

    // Com vendas importadas cobrindo pouco da receita, não multiplica: só avisa.
    const tiny = buildCompetenceDre(input({ soldGrossRevenue: 18000 }));
    expect(tiny.cmv).toBe(85000);
    expect(tiny.lines.find((l) => l.key === "cmv")?.source).toBe("lancamentos");
    expect(tiny.warnings.some((w) => w.includes("não foi ajustado"))).toBe(true);

    // Sem custo por peça vendida (valor pago no mês), não ajusta.
    expect(buildCompetenceDre(input({ soldGrossRevenue: 350000, cmvFromSoldPieces: false })).cmv).toBe(85000);
  });

  it("avisa quando o custo das peças ainda está pelo valor pago", () => {
    const dre = buildCompetenceDre(input({ cmvFromSoldPieces: false }));
    expect(dre.warnings.some((w) => w.includes("valor pago no mês"))).toBe(true);
  });
});
