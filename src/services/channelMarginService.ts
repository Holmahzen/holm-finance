import { prisma } from "@/lib/prisma";
import { marketplaceSaleRepository } from "@/repositories/marketplaceSaleRepository";
import { fiscalNoteRepository } from "@/repositories/fiscalNoteRepository";
import { pgdasRepository } from "@/repositories/pgdasRepository";
import { productRepository } from "@/repositories/productRepository";
import { shiftMonth } from "@/domain/fiscalNotes";
import { overlapShare } from "@/domain/adSpendAllocation";
import { directSalesChannel, marketplaceChannel } from "@/domain/channelMargin";
import { todayUTCInBrazil } from "@/lib/today";

/** Sem extrato do PGDAS importado: o percentual que o Mercado Turbo usa no ML. */
const FALLBACK_TAX_RATE = 0.14;

export const channelMarginService = {
  /** `months` meses terminando em `toMonth` (padrão: o mês passado). */
  async getReport(months = 1, toMonth?: string) {
    const today = todayUTCInBrazil();
    const current = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
    const to = toMonth && /^\d{4}-\d{2}$/.test(toMonth) ? toMonth : shiftMonth(current, -1);
    const span = Math.min(12, Math.max(1, Math.round(months)));
    const from = shiftMonth(to, -(span - 1));
    const [fy, fm] = from.split("-").map(Number);
    const [ty, tm] = to.split("-").map(Number);
    const start = new Date(fy, fm - 1, 1);
    const end = new Date(ty, tm, 1);

    const [sales, noteRows, apuracoes, costRows, adRows, full] = await Promise.all([
      marketplaceSaleRepository.findByPeriod(start, end),
      fiscalNoteRepository.findProductRowsBetween(from, to),
      pgdasRepository.findApuracoes(shiftMonth(to, -12)),
      productRepository.getProductCostsBySku(),
      prisma.mlAdSpend.findMany({
        where: { periodStart: { lt: end }, periodEnd: { gte: start } },
        select: { periodStart: true, periodEnd: true, investimento: true },
      }),
      prisma.mlFullCost.aggregate({ where: { costDate: { gte: start, lt: end } }, _sum: { amount: true } }),
    ]);

    // Alíquota efetiva do extrato mais recente até o fim do período.
    const latest = apuracoes.filter((a) => a.period <= to && a.revenue > 0).at(-1);
    const taxRate = latest ? latest.taxes.total / latest.revenue : FALLBACK_TAX_RATE;
    const taxRateSource = latest ? `extrato do PGDAS-D de ${latest.period.slice(5)}/${latest.period.slice(0, 4)}` : "padrão (sem extrato do PGDAS-D)";

    const costs = new Map(costRows.map((c) => [c.sku, c]));
    const toAggregation = (s: (typeof sales)[number]) => ({
      sku: s.sku,
      productName: s.productName,
      quantity: s.quantity,
      grossRevenue: Number(s.grossRevenue),
      netRevenue: Number(s.netRevenue),
      marketplaceCost: Number(s.marketplaceCost),
      status: s.status,
      shippingModality: s.shippingModality,
    });
    const ads = adRows.reduce((sum, r) => sum + Number(r.investimento) * overlapShare(r.periodStart, r.periodEnd, start, end), 0);

    const channels = [
      // Mercado Livre e Shopee: o Mercado Turbo já desconta o imposto (taxRate 0).
      marketplaceChannel(
        "mercadoLivre",
        sales.filter((s) => s.channel !== "Shopee").map(toAggregation),
        costs,
        0,
        ads,
        Number(full._sum.amount ?? 0),
      ),
      marketplaceChannel("shopee", sales.filter((s) => s.channel === "Shopee").map(toAggregation), costs, 0),
      directSalesChannel(noteRows, costs, taxRate),
    ];

    const revenue = channels.reduce((s, c) => s + c.revenue, 0);
    const costedRevenue = channels.reduce((s, c) => s + c.costedRevenue, 0);
    const contribution = channels.reduce((s, c) => s + c.contribution, 0);
    return {
      from,
      to,
      months: span,
      taxRate,
      taxRateSource,
      channels,
      total: { revenue, contribution, marginPercent: costedRevenue > 0 ? contribution / costedRevenue : null },
    };
  },
};
