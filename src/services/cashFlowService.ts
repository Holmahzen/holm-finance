import { dashboardRepository } from "@/repositories/dashboardRepository";
import { entryRepository } from "@/repositories/entryRepository";
import { mercadoLivreReceivableService } from "@/services/mercadoLivreReceivableService";
import {
  computeCashFlowProjection,
  findFirstNegativeDay,
  type CashFlowMovement,
} from "@/domain/cashFlow";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const cashFlowService = {
  async getProjection(range: number | "month" = 30) {
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

    // "month" = até o fim do mês vigente, em vez de N dias corridos a partir
    // de hoje — evita que o alerta de "não sobra nada" misture contas do mês
    // que vem junto com as do mês atual.
    const windowEnd =
      range === "month"
        ? new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1))
        : new Date(todayUTC.getTime() + range * MS_PER_DAY);
    const days = Math.round((windowEnd.getTime() - todayUTC.getTime()) / MS_PER_DAY);

    const tomorrowUTC = new Date(todayUTC.getTime() + MS_PER_DAY);

    const [accounts, entries, mlReceivable, paidToday] = await Promise.all([
      dashboardRepository.getAccountBalances(),
      entryRepository.findMany({ status: "PENDING" }),
      mercadoLivreReceivableService.get(),
      entryRepository.findMany({
        status: "PAID",
        paidAt: { gte: todayUTC, lt: tomorrowUTC },
      }),
    ]);

    const startingBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);

    const movements: CashFlowMovement[] = [];

    for (const e of entries) {
      const rawDate = e.plannedPaymentDate ?? e.dueDate;
      // Vencidos (data no passado) ainda não foram pagos — jogamos pra hoje
      // em vez de sumir da projeção, já que esse dinheiro pode entrar/sair
      // a qualquer momento a partir de agora.
      const effectiveDate = rawDate < todayUTC ? todayUTC : rawDate;
      if (effectiveDate >= windowEnd) continue;

      const amount = e.type === "RECEIVABLE" ? Number(e.amount) : -Number(e.amount);
      movements.push({ date: effectiveDate, amount, label: e.description });
    }

    // Recebimentos do Mercado Livre "a liberar" (informado manualmente em
    // Início, sem data exata) — hoje/amanhã/até 7 dias entram na projeção
    // nos dias correspondentes; "após 7 dias" não tem data conhecida, então
    // fica de fora da curva e é devolvido só como valor informativo à parte.
    const mlToday = Number(mlReceivable.today);
    const mlTomorrow = Number(mlReceivable.tomorrow);
    const mlWithin7d = Number(mlReceivable.within7d);
    const mlAfter7d = Number(mlReceivable.after7d);

    if (mlToday > 0) {
      movements.push({ date: todayUTC, amount: mlToday, label: "Mercado Livre — a liberar hoje" });
    }
    if (mlTomorrow > 0) {
      movements.push({
        date: new Date(todayUTC.getTime() + MS_PER_DAY),
        amount: mlTomorrow,
        label: "Mercado Livre — a liberar amanhã",
      });
    }
    if (mlWithin7d > 0) {
      movements.push({
        date: new Date(todayUTC.getTime() + 7 * MS_PER_DAY),
        amount: mlWithin7d,
        label: "Mercado Livre — a liberar até 7 dias",
      });
    }

    const projection = computeCashFlowProjection(startingBalance, movements, todayUTC, days);
    const firstNegativeDay = findFirstNegativeDay(projection);

    // Quanto dá pra gastar agora sem comprometer o que já está pendente pra
    // sair (inclusive custos fixos) nos próximos `days` dias — desconta só
    // as saídas já previstas, sem contar com nenhuma entrada futura (nem
    // confirmada), pra nunca sugerir gastar mais do que existe garantido.
    const totalPendingOutflows = movements
      .filter((m) => m.amount < 0)
      .reduce((sum, m) => sum + Math.abs(m.amount), 0);
    const safeToSpend = Math.max(0, startingBalance - totalPendingOutflows);

    // Mesma conta, só que otimista: soma também o que está "a liberar" no
    // Mercado Livre (as 4 faixas informadas em Início, inclusive "após 7
    // dias" — que não tem data exata e por isso fica fora da curva/projeção).
    const mlTotal = mlToday + mlTomorrow + mlWithin7d + mlAfter7d;
    const safeToSpendWithML = Math.max(0, startingBalance - totalPendingOutflows + mlTotal);

    const realizedTodayMovements: CashFlowMovement[] = paidToday.map((e) => ({
      date: todayUTC,
      amount: e.type === "RECEIVABLE" ? Number(e.paidAmount ?? e.amount) : -Number(e.paidAmount ?? e.amount),
      label: e.description,
    }));
    const realizedToday = {
      inflow: realizedTodayMovements.filter((m) => m.amount > 0).reduce((s, m) => s + m.amount, 0),
      outflow: realizedTodayMovements
        .filter((m) => m.amount < 0)
        .reduce((s, m) => s + Math.abs(m.amount), 0),
      movements: realizedTodayMovements,
    };

    return {
      startingBalance,
      days: projection,
      firstNegativeDay,
      mlAfter7d,
      realizedToday,
      safeToSpend,
      safeToSpendWithML,
      mlTotal,
      totalPendingOutflows,
    };
  },
};
