import { prisma } from "@/lib/prisma";
import type { ParsedPgdasExtract } from "@/parsers/pgdas/pgdasExtractParser";

export const pgdasRepository = {
  /**
   * Grava a apuração do mês e o faturamento mensal que o extrato declara.
   * Cada mês guarda o valor da declaração mais recente: um extrato de agosto
   * não sobrescreve o que já veio de um extrato de setembro.
   */
  async saveExtract(e: ParsedPgdasExtract) {
    const apuracao = {
      apuracaoNumber: e.apuracaoNumber,
      rectifying: e.rectifying,
      revenue: e.revenue,
      rbt12: e.rbt12,
      rba: e.rba,
      rbaa: e.rbaa,
      sublimit: e.sublimit,
      ceiling: e.ceiling,
      icmsBlocked: e.icmsBlocked,
      ...e.taxes,
      activities: e.activities,
      dasNumber: e.das.number,
      dasDueDate: e.das.dueDate,
      dasPaid: e.das.paid,
      importedAt: new Date(),
    };

    const months = [...e.previousRevenues, { month: e.period, revenue: e.revenue }];
    const existing = await prisma.pgdasMonthlyRevenue.findMany({
      where: { month: { in: months.map((m) => m.month) } },
      select: { month: true, sourcePeriod: true },
    });
    const sourceByMonth = new Map(existing.map((r) => [r.month, r.sourcePeriod]));
    const writable = months.filter((m) => (sourceByMonth.get(m.month) ?? "") <= e.period);

    await prisma.$transaction([
      prisma.pgdasApuracao.upsert({
        where: { period: e.period },
        update: apuracao,
        create: { period: e.period, ...apuracao },
      }),
      ...writable.map((m) =>
        prisma.pgdasMonthlyRevenue.upsert({
          where: { month: m.month },
          update: { revenue: m.revenue, sourcePeriod: e.period },
          create: { month: m.month, revenue: m.revenue, sourcePeriod: e.period },
        }),
      ),
    ]);

    return { months: writable.length };
  },

  async findMonthlyRevenues(fromMonth: string): Promise<Record<string, number>> {
    const rows = await prisma.pgdasMonthlyRevenue.findMany({ where: { month: { gte: fromMonth } } });
    return Object.fromEntries(rows.map((r) => [r.month, Number(r.revenue)]));
  },

  async findApuracoes(fromPeriod: string) {
    const rows = await prisma.pgdasApuracao.findMany({
      where: { period: { gte: fromPeriod } },
      orderBy: { period: "asc" },
    });
    return rows.map(mapApuracao);
  },

  /** Uma apuração específica ("YYYY-MM"), ou null se esse mês nunca teve extrato importado. */
  async findApuracao(period: string) {
    const row = await prisma.pgdasApuracao.findUnique({ where: { period } });
    return row ? mapApuracao(row) : null;
  },
};

function mapApuracao(r: {
  period: string;
  rectifying: boolean;
  revenue: unknown;
  rbt12: unknown;
  rba: unknown;
  sublimit: unknown;
  icmsBlocked: boolean | null;
  irpj: unknown;
  csll: unknown;
  cofins: unknown;
  pis: unknown;
  cpp: unknown;
  icms: unknown;
  ipi: unknown;
  iss: unknown;
  total: unknown;
  activities: unknown;
  dasDueDate: Date | null;
  dasPaid: boolean | null;
  importedAt: Date;
}) {
  return {
    period: r.period,
    rectifying: r.rectifying,
    revenue: Number(r.revenue),
    rbt12: Number(r.rbt12),
    rba: Number(r.rba),
    sublimit: r.sublimit == null ? null : Number(r.sublimit),
    icmsBlocked: r.icmsBlocked,
    taxes: {
      irpj: Number(r.irpj),
      csll: Number(r.csll),
      cofins: Number(r.cofins),
      pis: Number(r.pis),
      cpp: Number(r.cpp),
      icms: Number(r.icms),
      ipi: Number(r.ipi),
      iss: Number(r.iss),
      total: Number(r.total),
    },
    activities: r.activities as { kind: string; description: string; revenue: number; taxes: Record<string, number> }[],
    dasDueDate: r.dasDueDate ? r.dasDueDate.toISOString().slice(0, 10) : null,
    dasPaid: r.dasPaid,
    importedAt: r.importedAt,
  };
}
