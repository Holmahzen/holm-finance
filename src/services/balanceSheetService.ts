import { dashboardRepository } from "@/repositories/dashboardRepository";
import { loanRepository } from "@/repositories/loanRepository";
import { balanceSheetItemRepository } from "@/repositories/balanceSheetItemRepository";
import { computeOutstandingPrincipal } from "@/domain/loanAmortization";
import { computeBalanceSheet, type BalanceSheetLine } from "@/domain/balanceSheet";

export const balanceSheetService = {
  async getReport() {
    const [accounts, pending, loans, manualItems] = await Promise.all([
      dashboardRepository.getAccountBalances(),
      dashboardRepository.getPendingEntriesSummary(),
      loanRepository.findActive(),
      balanceSheetItemRepository.findActive(),
    ]);

    const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);

    const loanLines: BalanceSheetLine[] = [];
    for (const loan of loans) {
      const payments = await loanRepository.findPaidPayments(loan.matchText);
      const outstanding = computeOutstandingPrincipal(
        {
          principal: Number(loan.principal),
          monthlyRatePercent: Number(loan.monthlyRatePercent),
          installments: loan.installments,
        },
        payments.length,
      );
      if (outstanding > 0) loanLines.push({ label: loan.description, amount: outstanding });
    }

    const manualLines = (section: string): BalanceSheetLine[] =>
      manualItems
        .filter((item) => item.section === section)
        .map((item) => ({ label: item.description, amount: Number(item.amount) }));

    const report = computeBalanceSheet({
      ativoCirculante: [
        { label: "Caixa e contas bancárias", amount: totalBalance },
        { label: "Contas a receber", amount: Number(pending.receivable.total) },
        ...manualLines("ATIVO_CIRCULANTE"),
      ],
      ativoNaoCirculante: manualLines("ATIVO_NAO_CIRCULANTE"),
      passivoCirculante: [
        { label: "Contas a pagar", amount: Number(pending.payable.total) },
        ...manualLines("PASSIVO_CIRCULANTE"),
      ],
      passivoNaoCirculante: [...loanLines, ...manualLines("PASSIVO_NAO_CIRCULANTE")],
      patrimonioLiquidoManual: manualLines("PATRIMONIO_LIQUIDO"),
    });

    return { ...report, generatedAt: new Date().toISOString() };
  },
};
