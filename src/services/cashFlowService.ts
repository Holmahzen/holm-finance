import { dashboardRepository } from "@/repositories/dashboardRepository";
import { entryRepository } from "@/repositories/entryRepository";
import { productRepository } from "@/repositories/productRepository";
import { marketplaceSaleRepository } from "@/repositories/marketplaceSaleRepository";
import { plannedPurchaseRepository } from "@/repositories/plannedPurchaseRepository";
import { mercadoLivreReleaseService } from "@/services/mercadoLivreReleaseService";
import {
  computeCashFlowProjection,
  findFirstNegativeDay,
  aggregateProjectionByWeek,
  type CashFlowMovement,
} from "@/domain/cashFlow";
import { aggregateSalesBySku, isExcludedSaleStatus } from "@/domain/salesAggregation";
import { computeCogsBySku, computeMaterialSpendSplit } from "@/domain/cogs";
import { plannedPurchaseMovements, suggestPurchase } from "@/domain/plannedPurchase";
import { estimateFlexInvoices } from "@/domain/flexEstimate";
import { FLEX_COST_PER_PACKAGE } from "@/domain/breakEven";
import { todayUTCInBrazil } from "@/lib/today";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MATERIAL_SPLIT_MIN_COVERAGE_PERCENT = 80;

export const cashFlowService = {
  async getProjection(range: number | "month" = 30) {
    const todayUTC = todayUTCInBrazil();

    // "month" = até o fim do mês vigente, em vez de N dias corridos a partir
    // de hoje — evita que o alerta de "não sobra nada" misture contas do mês
    // que vem junto com as do mês atual.
    const windowEnd =
      range === "month"
        ? new Date(Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth() + 1, 1))
        : new Date(todayUTC.getTime() + range * MS_PER_DAY);
    const days = Math.round((windowEnd.getTime() - todayUTC.getTime()) / MS_PER_DAY);

    const tomorrowUTC = new Date(todayUTC.getTime() + MS_PER_DAY);

    const last30dStart = new Date(todayUTC.getTime() - 30 * MS_PER_DAY);

    const [accounts, entries, mlReport, paidToday, recentSales, productCosts, plannedRows, flexEntryRows] = await Promise.all([
      dashboardRepository.getAccountBalances(),
      entryRepository.findMany({ status: "PENDING" }),
      mercadoLivreReleaseService.getReport(todayUTC),
      entryRepository.findMany({
        status: "PAID",
        paidAt: { gte: todayUTC, lt: tomorrowUTC },
      }),
      marketplaceSaleRepository.findByPeriod(last30dStart, tomorrowUTC),
      productRepository.getProductCostsBySku(),
      plannedPurchaseRepository.findMany(),
      // faturas Flex já lançadas (pendentes ou pagas): quando a real existe, a estimativa some
      entryRepository.findMany({
        category: { name: "Flex" },
        dueDate: { gte: new Date(todayUTC.getTime() - 40 * MS_PER_DAY) },
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
      const cardName = e.creditCardPurchase?.creditCard?.name ?? e.fixedCost?.creditCard?.name ?? null;
      movements.push({ date: effectiveDate, amount, label: e.description, cardName, categoryName: e.category?.name ?? null });
    }

    // Repasse do Mercado Livre, dia a dia — data real vinda do hub (ou
    // estimada por entrega, sem o hub), não mais só hoje/amanhã/até 7 dias
    // resumidos: cada dia que ainda vai liberar entra na curva na data certa,
    // até onde o período escolhido alcançar.
    let mlInWindow = 0;
    for (const day of mlReport.days) {
      if (day.released) continue;
      // `mlReport.days[].date` vem como "YYYY-MM-DD" (formato de API) — parse
      // manual em UTC, senão `new Date(texto)` local desloca o dia inteiro.
      const [y, m, d] = day.date.split("-").map(Number);
      const dayDate = new Date(Date.UTC(y, m - 1, d));
      if (dayDate >= windowEnd) continue;
      movements.push({ date: dayDate, amount: day.amount, label: "Mercado Livre — repasse" });
      mlInWindow += day.amount;
    }

    // Fatura Flex (transportadora, R$ por pacote, paga por quinzena): estimada
    // pelas vendas Flex já importadas, até virar o lançamento real.
    const validRecentSales = recentSales.filter((s) => !isExcludedSaleStatus(s.status));
    const flexByDayMap = new Map<number, number>();
    for (const sale of validRecentSales) {
      if ((sale.shippingModality ?? "").trim().toLowerCase() !== "flex") continue;
      const key = sale.saleDate.getTime();
      flexByDayMap.set(key, (flexByDayMap.get(key) ?? 0) + 1);
    }
    const flexByDay = [...flexByDayMap.entries()].map(([t, flexCount]) => ({ date: new Date(t), flexCount }));
    movements.push(
      ...estimateFlexInvoices({
        today: todayUTC,
        windowEnd,
        flexByDay,
        lastSaleDate: recentSales.reduce<Date | null>(
          (max, sale) => (max === null || sale.saleDate > max ? sale.saleDate : max),
          null,
        ),
        paceFlexPerDay: flexByDay.reduce((sum, d) => sum + d.flexCount, 0) / 30,
        feePerPackage: FLEX_COST_PER_PACKAGE,
        flexEntries: flexEntryRows.map((e) => ({ date: e.dueDate, amount: Number(e.amount) })),
      }),
    );

    const projection = computeCashFlowProjection(startingBalance, movements, todayUTC, days);
    const firstNegativeDay = findFirstNegativeDay(projection);

    // Compras planejadas: mesma curva com as saídas simuladas por cima. Fica
    // separada de `movements` de propósito — nada disso entra em "pode gastar".
    const plannedMovements = plannedPurchaseMovements(
      plannedRows.map((p) => ({
        kind: p.kind,
        label: p.label,
        amount: Number(p.amount),
        dueDate: p.dueDate,
        installments: p.installments,
      })),
      todayUTC,
      windowEnd,
    );
    const projectionWithPlanned = computeCashFlowProjection(
      startingBalance,
      [...movements, ...plannedMovements],
      todayUTC,
      days,
    );
    const lowestWithPlanned = projectionWithPlanned.reduce(
      (min, d) => (d.runningBalance < min.runningBalance ? d : min),
      projectionWithPlanned[0],
    );

    // Quanto dá pra gastar agora sem comprometer o que já está pendente pra
    // sair (inclusive custos fixos) nos próximos `days` dias — desconta só
    // as saídas já previstas, sem contar com nenhuma entrada futura (nem
    // confirmada), pra nunca sugerir gastar mais do que existe garantido.
    const totalPendingOutflows = movements
      .filter((m) => m.amount < 0)
      .reduce((sum, m) => sum + Math.abs(m.amount), 0);
    const safeToSpend = Math.max(0, startingBalance - totalPendingOutflows);

    // Mesma conta, só que otimista: soma também tudo que ainda vai liberar do
    // Mercado Livre — inclusive o que ainda não tem data exata (depende da
    // entrega) ou cai fora do período escolhido na tela.
    const mlTotal = mlReport.scheduledTotal + mlReport.awaitingDelivery.amount;
    const safeToSpendWithML = Math.max(0, startingBalance - totalPendingOutflows + mlTotal);
    // O que fica de fora da curva acima: ou não tem data conhecida ainda
    // (aguardando entrega), ou tem data mas ela é mais distante que o período
    // escolhido na tela (ex.: repasse em 45 dias numa projeção de 30 dias).
    const mlOutsideWindow = Math.max(0, mlTotal - mlInWindow);

    // Sugestão de pra onde deveria ir o "pode gastar": tecido x aviamento, na
    // mesma proporção das peças efetivamente vendidas nos últimos 30 dias
    // (custo cadastrado em Produtos × quantidade vendida) — não depende do
    // período de projeção escolhido na tela, reflete o mix de venda atual.
    const skuAggregates = aggregateSalesBySku(
      recentSales.map((s) => ({
        sku: s.sku,
        productName: s.productName,
        quantity: s.quantity,
        grossRevenue: Number(s.grossRevenue),
        netRevenue: Number(s.netRevenue),
        marketplaceCost: Number(s.marketplaceCost),
        status: s.status,
      })),
    );
    const cogs = computeCogsBySku(
      skuAggregates.map((s) => ({ sku: s.sku, quantity: s.quantity })),
      productCosts,
    );
    // Ritmo diário de receita líquida (últimos 30 dias) — nunca somado ao
    // "pode gastar" garantido, só mostrado ao lado da visão semanal como
    // contexto: vendas ainda não registradas continuam acontecendo todo dia,
    // mesmo que não entrem como "garantidas" na projeção.
    const last30dNetRevenue = recentSales
      .filter((s) => !isExcludedSaleStatus(s.status))
      .reduce((sum, s) => sum + Number(s.netRevenue), 0);
    const dailyNetRevenuePace = last30dNetRevenue / 30;

    const weeklyBreakdown = aggregateProjectionByWeek(projection).map((bucket) => ({
      ...bucket,
      estimatedAdditionalRevenue: dailyNetRevenuePace * bucket.days,
    }));

    const purchaseSuggestion = suggestPurchase(cogs, MATERIAL_SPLIT_MIN_COVERAGE_PERCENT);
    const split = computeMaterialSpendSplit(cogs.tecido, cogs.aviamentos);
    const materialSplit =
      split === null
        ? null
        : {
            tecidoPercent: split.tecidoPercent,
            aviamentoPercent: split.aviamentoPercent,
            coveragePercent: cogs.coveragePercent,
            lowCoverage:
              cogs.coveragePercent !== null && cogs.coveragePercent < MATERIAL_SPLIT_MIN_COVERAGE_PERCENT,
          };

    const realizedTodayMovements: CashFlowMovement[] = paidToday.map((e) => ({
      date: todayUTC,
      amount: e.type === "RECEIVABLE" ? Number(e.paidAmount ?? e.amount) : -Number(e.paidAmount ?? e.amount),
      label: e.description,
      cardName: e.creditCardPurchase?.creditCard?.name ?? e.fixedCost?.creditCard?.name ?? null,
      categoryName: e.category?.name ?? null,
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
      /* A composição do saldo inicial, conta a conta. A projeção inteira parte
         deste número, e saber de qual banco ele vem muda a leitura: saldo em
         conta de marketplace não é o mesmo que saldo na conta operacional. */
      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        balance: Number(a.balance),
        origem: a.origem,
        desde: a.desde ? a.desde.toISOString() : null,
      })),
      days: projection,
      firstNegativeDay,
      plannedPurchases: plannedRows.map((p) => ({
        id: p.id,
        kind: p.kind,
        label: p.label,
        amount: Number(p.amount),
        dueDate: p.dueDate.toISOString().slice(0, 10),
        installments: p.installments,
        parentId: p.parentId,
      })),
      withPlanned: {
        days: projectionWithPlanned,
        endBalance: projectionWithPlanned[projectionWithPlanned.length - 1].runningBalance,
        lowestDay: { date: lowestWithPlanned.date, balance: lowestWithPlanned.runningBalance },
        firstNegativeDay: findFirstNegativeDay(projectionWithPlanned),
      },
      purchaseSuggestion,
      mlOutsideWindow,
      realizedToday,
      safeToSpend,
      safeToSpendWithML,
      mlTotal,
      totalPendingOutflows,
      materialSplit,
      weeklyBreakdown,
      dailyNetRevenuePace,
    };
  },
};
