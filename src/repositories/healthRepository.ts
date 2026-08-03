import { prisma } from "@/lib/prisma";

export const healthRepository = {
  /**
   * Saldo total das contas ativas "como estava" no fim de cada mês da
   * série. Usa o extrato importado mais recente até aquela data (mesma
   * lógica do saldo atual, só que ancorada no passado); sem extrato até
   * ali, cai pro saldo inicial + pago/recebido até a data.
   */
  async getBalanceHistory(monthEnds: Date[]) {
    const accounts = await prisma.financialAccount.findMany({ where: { isActive: true } });
    const accountIds = accounts.map((a) => a.id);

    const [batches, entries] = await Promise.all([
      prisma.importBatch.findMany({
        where: { bankAccountId: { in: accountIds }, ledgerBalance: { not: null } },
        orderBy: { ledgerBalanceDate: "asc" },
        select: { bankAccountId: true, ledgerBalance: true, ledgerBalanceDate: true },
      }),
      prisma.entry.findMany({
        where: { status: "PAID", bankAccountId: { in: accountIds } },
        select: { bankAccountId: true, type: true, paidAmount: true, paidAt: true },
      }),
    ]);

    return monthEnds.map((asOf) => {
      let total = 0;
      for (const account of accounts) {
        const accountBatches = batches.filter(
          (b) => b.bankAccountId === account.id && b.ledgerBalanceDate && b.ledgerBalanceDate <= asOf,
        );
        const latest = accountBatches[accountBatches.length - 1];
        if (latest?.ledgerBalance) {
          total += Number(latest.ledgerBalance);
          continue;
        }

        let paidIn = 0;
        let paidOut = 0;
        for (const e of entries) {
          if (e.bankAccountId !== account.id || !e.paidAt || e.paidAt > asOf) continue;
          if (e.type === "RECEIVABLE") paidIn += Number(e.paidAmount ?? 0);
          else paidOut += Number(e.paidAmount ?? 0);
        }
        total += Number(account.openingBalance) + paidIn - paidOut;
      }
      return total;
    });
  },
};
