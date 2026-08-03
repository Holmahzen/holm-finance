import { dreRepository } from "@/repositories/dreRepository";
import { productRepository } from "@/repositories/productRepository";
import { loanRepository } from "@/repositories/loanRepository";
import { computeDre, type DreGroup, type DreGroupTotals, type DreLine } from "@/domain/dre";
import { computeCogsBySku } from "@/domain/cogs";
import { computeLoanInterestForPeriod } from "@/domain/loanAmortization";

const COGS_LINE_NAMES = ["Tecido", "Costura", "Aviamentos"] as const;
type CogsLineName = (typeof COGS_LINE_NAMES)[number];

// Só troca a linha de "valor pago no mês" pra "custo das peças vendidas"
// quando a maior parte da quantidade vendida no período já tem custo
// cadastrado — com poucos SKUs cadastrados, trocar cedo demais faz a linha
// contar como zero o custo de tudo que ainda não tem cadastro, subestimando
// o custo variável em vez de corrigi-lo.
const COGS_MIN_COVERAGE_PERCENT = 80;

export const dreService = {
  async getDRE(year?: number, month?: number) {
    const now = new Date();
    const y = year ?? now.getFullYear();
    const m = month ?? now.getMonth() + 1;
    const monthStart = new Date(y, m - 1, 1);
    const monthEnd = new Date(y, m, 1);

    const [categoryTotals, soldQuantities, productCosts, loans] = await Promise.all([
      dreRepository.getCategoryTotals(monthStart, monthEnd),
      dreRepository.getSoldQuantitiesBySku(monthStart, monthEnd),
      productRepository.getProductCostsBySku(),
      loanRepository.findActive(),
    ]);

    const byGroup: DreGroupTotals = {};
    for (const c of categoryTotals) {
      const group = c.dreGroup as DreGroup;
      const lines = byGroup[group] ?? (byGroup[group] = []);
      lines.push({ categoryId: c.categoryId, name: c.name, total: c.total });
    }

    // Tecido/Costura/Aviamentos: quando há produtos com custo por peça
    // cadastrado e vendas no período, usa quantidade vendida × custo por
    // peça (custo das peças efetivamente vendidas) em vez do valor pago no
    // mês — que pode incluir compra de estoque para meses futuros.
    const cogs = computeCogsBySku(soldQuantities, productCosts);
    if (cogs.coveragePercent !== null && cogs.coveragePercent >= COGS_MIN_COVERAGE_PERCENT) {
      const cogsValueByName: Record<CogsLineName, number> = {
        Tecido: cogs.tecido,
        Costura: cogs.costura,
        Aviamentos: cogs.aviamentos,
      };
      const cmvLines = byGroup.CUSTO_MERCADORIA_VENDIDA ?? [];
      for (const line of cmvLines) {
        if ((COGS_LINE_NAMES as readonly string[]).includes(line.name)) {
          line.total = cogsValueByName[line.name as CogsLineName];
          line.name = `${line.name} (peças vendidas)`;
        }
      }
    }

    // Empréstimos: o principal (entrada e amortização) não é resultado —
    // só os juros de cada parcela paga no período entram como despesa
    // financeira de verdade. Precisa do histórico completo de parcelas já
    // pagas (não só as do período) pra saber em que ponto da tabela Price
    // cada parcela está.
    const allLines: DreLine[] = Object.values(byGroup)
      .filter((lines): lines is DreLine[] => !!lines)
      .flat();

    for (const loan of loans) {
      const payments = await loanRepository.findPaidPayments(loan.matchText);
      const split = computeLoanInterestForPeriod(
        {
          principal: Number(loan.principal),
          monthlyRatePercent: Number(loan.monthlyRatePercent),
          installments: loan.installments,
        },
        payments.map((p) => ({ id: p.id, paidAmount: Number(p.paidAmount ?? 0), paidAt: p.paidAt! })),
        monthStart,
        monthEnd,
      );
      if (split.matchedCount === 0) continue;

      const line = allLines.find((l) => l.categoryId === loan.categoryId);
      if (line) {
        line.total = line.total - split.cashPaidInPeriod + split.interestInPeriod;
        if (!line.name.endsWith("(só juros)")) line.name = `${line.name} (só juros)`;
      }
    }

    for (const lines of Object.values(byGroup)) {
      lines?.sort((a, b) => b.total - a.total);
    }

    const report = computeDre(byGroup);

    return {
      period: { year: y, month: m },
      cogsMatchedSkus: cogs.matchedSkus,
      cogsUnmatchedSkus: cogs.unmatchedSkus,
      cogsCoveragePercent: cogs.coveragePercent,
      cogsMinCoveragePercent: COGS_MIN_COVERAGE_PERCENT,
      ...report,
    };
  },
};
