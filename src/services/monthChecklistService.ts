import { prisma } from "@/lib/prisma";
import { todayUTCInBrazil } from "@/lib/today";
import { fiscalNoteRepository } from "@/repositories/fiscalNoteRepository";
import { summarizeMonths } from "@/domain/fiscalNotes";
import { productPriorityService } from "@/services/productPriorityService";
import { dreCompetenciaService } from "@/services/dreCompetenciaService";
import { formatBRL } from "@/lib/format";
import {
  availableFrom,
  countStatus,
  coverageStatus,
  coveredDays,
  daysExpected,
  formatDay,
  monthWindow,
  summarize,
  type ChecklistItem,
  type MonthWindow,
} from "@/domain/monthChecklist";

const DAY_MS = 24 * 60 * 60 * 1000;

function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function bankStatements(w: MonthWindow): Promise<ChecklistItem[]> {
  const accounts = await prisma.financialAccount.findMany({
    where: { isActive: true, importBatches: { some: {} } },
    select: { id: true, name: true, importBatches: { select: { endDate: true }, orderBy: { endDate: "desc" }, take: 1 } },
  });
  return accounts.map((a) => {
    const { status, detail } = coverageStatus(a.importBatches[0]?.endDate ?? null, w);
    return { key: `extrato-${a.id}`, group: "Importações", title: `Extrato ${a.name}`, status, detail, href: "/imports" };
  });
}

/** Última venda do mês num relatório; null se não há venda do mês. */
async function latestSale(model: "marketplace" | "mercadoLivre", w: MonthWindow, channel?: "Shopee" | "ML") {
  const where = { saleDate: { gte: w.start, lt: w.end } };
  if (model === "mercadoLivre") {
    const r = await prisma.mercadoLivreSale.findFirst({ where, orderBy: { saleDate: "desc" }, select: { saleDate: true } });
    return r?.saleDate ?? null;
  }
  const r = await prisma.marketplaceSale.findFirst({
    where: { ...where, channel: channel === "Shopee" ? "Shopee" : { not: "Shopee" } },
    orderBy: { saleDate: "desc" },
    select: { saleDate: true },
  });
  return r?.saleDate ?? null;
}

async function salesReports(w: MonthWindow): Promise<ChecklistItem[]> {
  const prevStart = new Date(w.start.getTime() - 90 * DAY_MS);
  const [mt, shopee, ml, shopeeBefore] = await Promise.all([
    latestSale("marketplace", w, "ML"),
    latestSale("marketplace", w, "Shopee"),
    latestSale("mercadoLivre", w),
    prisma.marketplaceSale.count({ where: { channel: "Shopee", saleDate: { gte: prevStart, lt: w.start } } }),
  ]);
  const items: ChecklistItem[] = [
    {
      key: "vendas-mt",
      group: "Importações",
      title: "Vendas do Mercado Turbo",
      ...coverageStatus(mt, w),
      href: "/vendas",
    },
    {
      key: "vendas-ml",
      group: "Importações",
      title: "Relatório de vendas do Mercado Livre",
      ...coverageStatus(ml, w),
      href: "/vendas",
    },
  ];
  // Shopee só entra na lista se você vendeu por lá nos 3 meses anteriores.
  if (shopee || shopeeBefore > 0) {
    items.push({ key: "vendas-shopee", group: "Importações", title: "Vendas da Shopee", ...coverageStatus(shopee, w), href: "/vendas" });
  }
  return items;
}

async function adsAndFull(w: MonthWindow): Promise<ChecklistItem[]> {
  const prevStart = new Date(w.start.getTime() - 90 * DAY_MS);
  const [adRows, fullCount, fullBefore] = await Promise.all([
    prisma.mlAdSpend.findMany({
      where: { periodStart: { lt: w.end }, periodEnd: { gte: w.start } },
      select: { periodStart: true, periodEnd: true },
      distinct: ["periodStart", "periodEnd"],
    }),
    prisma.mlFullCost.count({ where: { costDate: { gte: w.start, lt: w.end } } }),
    prisma.mlFullCost.count({ where: { costDate: { gte: prevStart, lt: w.start } } }),
  ]);
  const expected = daysExpected(w);
  const covered = coveredDays(adRows.map((r) => ({ start: r.periodStart, end: r.periodEnd })), w);
  const items: ChecklistItem[] = [
    {
      key: "ads",
      group: "Importações",
      title: "Relatório de Ads (Anúncios patrocinados)",
      status: expected === 0 ? "aguardando" : covered >= expected ? "ok" : covered > 0 ? "parcial" : "pendente",
      detail:
        covered >= expected && expected > 0
          ? "O mês inteiro está coberto. Exporte sempre do dia 1 ao último dia do mês."
          : covered > 0
            ? `Cobre ${covered} de ${expected} dias do mês.`
            : "Nenhum relatório cobre este mês. Exporte do dia 1 ao último dia do mês.",
      href: "/vendas",
    },
  ];
  if (fullCount > 0 || fullBefore > 0) {
    items.push({
      key: "full",
      group: "Importações",
      title: "Relatório de tarifas do Full",
      status: fullCount > 0 ? "ok" : w.inProgress ? "aguardando" : "pendente",
      detail: fullCount > 0 ? `${fullCount} cobranças do Full no mês.` : "Nenhuma cobrança do Full importada deste mês.",
      href: "/vendas",
    });
  }
  return items;
}

async function fiscalDocuments(w: MonthWindow, today: Date): Promise<ChecklistItem[]> {
  const [noteRows, serviceNotes, pgdas] = await Promise.all([
    fiscalNoteRepository.findRowsSince(w.month),
    prisma.mlServiceInvoice.count({ where: { referenceMonth: w.month } }),
    prisma.pgdasApuracao.findUnique({ where: { period: w.month }, select: { period: true } }),
  ]);
  const month = summarizeMonths(noteRows).find((s) => s.month === w.month);
  const saleNotes = month?.saleNotes ?? 0;
  const pgdasFrom = availableFrom(w, 20);
  const serviceFrom = availableFrom(w, 10);
  return [
    {
      key: "notas-venda",
      group: "Importações",
      title: "XML das notas fiscais de venda",
      status: saleNotes > 0 ? (w.inProgress ? "parcial" : "ok") : w.inProgress ? "aguardando" : "pendente",
      detail:
        saleNotes > 0
          ? `${saleNotes} notas de venda (${formatBRL(month!.netSales)} líquido de devoluções).`
          : "Nenhuma nota de venda importada deste mês.",
      href: "/notas-fiscais",
    },
    {
      key: "notas-servico-ml",
      group: "Importações",
      title: "Notas de serviço do Mercado Livre (Ebazar / Mercado Pago)",
      status: serviceNotes > 0 ? "ok" : today < serviceFrom ? "aguardando" : "pendente",
      detail:
        serviceNotes > 0
          ? `${serviceNotes} notas com mês de referência ${w.month.slice(5)}/${w.month.slice(0, 4)}.`
          : today < serviceFrom
            ? `Saem no começo do mês seguinte — confira a partir de ${formatDay(serviceFrom)}.`
            : "Sem elas, a DRE por competência fica sem as tarifas do Mercado Livre.",
      href: "/notas-fiscais",
    },
    {
      key: "pgdas",
      group: "Importações",
      title: "Extrato do PGDAS-D (Simples Nacional)",
      status: pgdas ? "ok" : today < pgdasFrom ? "aguardando" : "pendente",
      detail: pgdas
        ? "Faturamento e DAS oficiais importados."
        : today < pgdasFrom
          ? `Sai com a declaração, até ${formatDay(pgdasFrom)}. Até lá o DAS fica estimado.`
          : "Peça ao contador o PDF do extrato e importe na tela do Simples Nacional.",
      href: "/simples-nacional",
    },
  ];
}

async function reviews(w: MonthWindow, today: Date): Promise<ChecklistItem[]> {
  const [year, monthNumber] = w.month.split("-").map(Number);
  const [unreconciled, uncategorized, overdue, uncosted] = await Promise.all([
    prisma.importedTransaction.count({
      where: {
        postedAt: { gte: w.start, lt: w.end },
        isSelfTransfer: false,
        OR: [{ reconciliationMatch: null }, { reconciliationMatch: { status: { not: "CONFIRMED" } } }],
      },
    }),
    prisma.entry.count({
      where: {
        categoryId: null,
        status: { not: "CANCELED" },
        OR: [{ paidAt: { gte: w.start, lt: w.end } }, { paidAt: null, dueDate: { gte: w.start, lt: w.end } }],
      },
    }),
    prisma.entry.count({
      where: { status: "PENDING", dueDate: { gte: w.start, lt: new Date(Math.min(w.end.getTime(), today.getTime())) } },
    }),
    productPriorityService.getUncostedSkus(year, monthNumber),
  ]);
  const uncostedRevenue = uncosted.reduce((sum, s) => sum + s.grossRevenue, 0);
  return [
    {
      key: "conciliacao",
      group: "Conferências",
      title: "Extrato conciliado com os lançamentos",
      status: countStatus(unreconciled, true),
      detail: unreconciled === 0 ? "Todas as transações do extrato estão conciliadas." : `${unreconciled} transações do extrato sem lançamento confirmado.`,
      href: "/reconciliation",
    },
    {
      key: "sem-categoria",
      group: "Conferências",
      title: "Lançamentos com categoria",
      status: countStatus(uncategorized, true),
      detail: uncategorized === 0 ? "Todos os lançamentos do mês têm categoria." : `${uncategorized} lançamentos sem categoria — ficam fora da DRE.`,
      href: "/entries",
    },
    {
      key: "vencidas",
      group: "Conferências",
      title: "Contas vencidas baixadas",
      status: countStatus(overdue, true),
      detail: overdue === 0 ? "Nenhuma conta do mês vencida em aberto." : `${overdue} contas vencidas ainda marcadas como pendentes — pagou e não baixou?`,
      href: "/entries",
    },
    {
      key: "sku-sem-custo",
      group: "Conferências",
      title: "Produtos vendidos com custo cadastrado",
      status: countStatus(uncosted.length, true),
      detail:
        uncosted.length === 0
          ? "Todo SKU vendido no mês tem custo."
          : `${uncosted.length} SKUs vendidos sem custo (${formatBRL(uncostedRevenue)} em vendas) — a margem deles fica otimista.`,
      href: "/custo-por-modelo",
    },
  ];
}

async function dreWarnings(w: MonthWindow): Promise<ChecklistItem[]> {
  const result = await dreCompetenciaService.getReport(w.month, { withTrend: false });
  if (result.month !== w.month || !result.report) return [];
  // PGDAS e notas de serviço já são itens próprios do checklist.
  const duplicated = /PGDAS|notas de serviço/i;
  return result.report.warnings.filter((warning) => !duplicated.test(warning)).map((warning, i) => ({
    key: `dre-${i}`,
    group: "Avisos da DRE" as const,
    title: "DRE por competência",
    status: "pendente" as const,
    detail: warning,
    href: "/dre-competencia",
  }));
}

export const monthChecklistService = {
  /** Sem mês: o mês passado (o que normalmente está sendo fechado). */
  async getChecklist(requestedMonth?: string) {
    const today = todayUTCInBrazil();
    const current = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
    const month = requestedMonth && /^\d{4}-\d{2}$/.test(requestedMonth) ? requestedMonth : previousMonth(current);
    const w = monthWindow(month, today);

    const groups = await Promise.all([
      bankStatements(w),
      salesReports(w),
      adsAndFull(w),
      fiscalDocuments(w, today),
      reviews(w, today),
      dreWarnings(w),
    ]);
    const items = groups.flat();
    return { month, inProgress: w.inProgress, items, summary: summarize(items) };
  },
};
