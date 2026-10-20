import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { DomainError } from "@/domain/errors";
import type { BillingLine, BillingSummary } from "@/domain/mlBilling";

export const billingSummarySchema = z.object({
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lines: z
    .array(
      z.object({
        detail: z.string().min(1).max(200),
        deducted: z.enum(["SIM", "NAO", "NA"]),
        count: z.number().int().min(0),
        amount: z.number().finite(),
      }),
    )
    .min(1)
    .max(200),
});

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

export const mlBillingService = {
  /** Substitui o resumo do ciclo (mesmo período), sem duplicar. */
  async save(input: unknown) {
    const parsed = billingSummarySchema.safeParse(input);
    if (!parsed.success) throw new DomainError("Resumo do relatório de faturamento inválido.");
    const { periodStart, periodEnd, lines } = parsed.data;
    if (periodEnd < periodStart) throw new DomainError("Período do relatório inválido.");

    await prisma.$transaction([
      prisma.mlBillingSummary.deleteMany({ where: { periodStart: day(periodStart), periodEnd: day(periodEnd) } }),
      prisma.mlBillingSummary.createMany({
        data: lines.map((l) => ({
          periodStart: day(periodStart),
          periodEnd: day(periodEnd),
          detail: l.detail,
          deducted: l.deducted,
          tariffCount: l.count,
          amount: l.amount,
        })),
      }),
    ]);
    return { periodStart, periodEnd, lines: lines.length };
  },

  /** Ciclos importados, do mais recente ao mais antigo. */
  async list(): Promise<(BillingSummary & { importedAt: string })[]> {
    const rows = await prisma.mlBillingSummary.findMany({ orderBy: [{ periodEnd: "desc" }, { amount: "desc" }] });
    const byPeriod = new Map<string, BillingSummary & { importedAt: string }>();
    for (const r of rows) {
      const start = r.periodStart.toISOString().slice(0, 10);
      const end = r.periodEnd.toISOString().slice(0, 10);
      const key = `${start}|${end}`;
      const entry = byPeriod.get(key) ?? { periodStart: start, periodEnd: end, lines: [] as BillingLine[], importedAt: r.importedAt.toISOString() };
      entry.lines.push({ detail: r.detail, deducted: r.deducted as BillingLine["deducted"], count: r.tariffCount, amount: Number(r.amount) });
      byPeriod.set(key, entry);
    }
    return [...byPeriod.values()];
  },
};
