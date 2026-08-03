import { fixedCostRepository } from "@/repositories/fixedCostRepository";
import { entryRepository } from "@/repositories/entryRepository";
import { NotFoundError, DomainError } from "@/domain/errors";
import { computeFixedCostDueDates, type FixedCostFrequency } from "@/domain/fixedCostSchedule";
import type {
  CreateFixedCostInput,
  UpdateFixedCostInput,
} from "@/domain/schemas/fixedCost";

const MAX_RANGE_MONTHS = 36;

function monthIndex(year: number, month: number) {
  return year * 12 + (month - 1);
}

function validateSchedule(schedule: {
  frequency: FixedCostFrequency;
  dueDay?: number | null;
  secondDueDay?: number | null;
  weekday?: number | null;
}) {
  if (schedule.frequency === "MONTHLY" && (schedule.dueDay === undefined || schedule.dueDay === null)) {
    throw new DomainError("Informe o dia do vencimento.");
  }
  if (
    schedule.frequency === "BIWEEKLY" &&
    (schedule.dueDay === undefined ||
      schedule.dueDay === null ||
      schedule.secondDueDay === undefined ||
      schedule.secondDueDay === null)
  ) {
    throw new DomainError("Informe os dois dias do vencimento (quinzenal).");
  }
  if (schedule.frequency === "WEEKLY" && (schedule.weekday === undefined || schedule.weekday === null)) {
    throw new DomainError("Informe o dia da semana.");
  }
}

export const fixedCostService = {
  list() {
    return fixedCostRepository.findMany();
  },

  async get(id: string) {
    const fixedCost = await fixedCostRepository.findById(id);
    if (!fixedCost) throw new NotFoundError("Custo fixo", id);
    return fixedCost;
  },

  create(input: CreateFixedCostInput) {
    validateSchedule(input);
    return fixedCostRepository.create(input);
  },

  async update(id: string, input: UpdateFixedCostInput) {
    const existing = await this.get(id);
    validateSchedule({
      frequency: input.frequency ?? existing.frequency,
      dueDay: input.dueDay ?? existing.dueDay,
      secondDueDay: input.secondDueDay ?? existing.secondDueDay,
      weekday: input.weekday ?? existing.weekday,
    });
    return fixedCostRepository.update(id, input);
  },

  async remove(id: string) {
    await this.get(id);
    // Os lançamentos já gerados por esse custo fixo continuam existindo
    // (são histórico real) — só perdem o vínculo com o custo fixo excluído.
    await fixedCostRepository.unlinkEntries(id);
    return fixedCostRepository.delete(id);
  },

  async generateForMonth(year: number, month: number) {
    const fixedCosts = await fixedCostRepository.findActive();

    let generated = 0;
    let skipped = 0;

    for (const fc of fixedCosts) {
      const dueDates = computeFixedCostDueDates(
        {
          frequency: fc.frequency,
          dueDay: fc.dueDay,
          secondDueDay: fc.secondDueDay,
          weekday: fc.weekday,
        },
        year,
        month,
      );

      for (const dueDate of dueDates) {
        const existing = await fixedCostRepository.findEntryForDate(fc.id, dueDate);
        if (existing) {
          skipped++;
          continue;
        }

        await entryRepository.create({
          type: fc.type,
          description: fc.description,
          amount: fc.amount,
          dueDate,
          categoryId: fc.categoryId,
          counterpartyId: fc.counterpartyId,
          fixedCostId: fc.id,
          status: "PENDING",
        });
        generated++;
      }
    }

    return { total: fixedCosts.length, generated, skipped };
  },

  async generateForRange(
    startYear: number,
    startMonth: number,
    endYear: number,
    endMonth: number,
  ) {
    const startIdx = monthIndex(startYear, startMonth);
    const endIdx = monthIndex(endYear, endMonth);

    if (endIdx < startIdx) {
      throw new DomainError("O mês final não pode ser antes do mês inicial.");
    }
    if (endIdx - startIdx + 1 > MAX_RANGE_MONTHS) {
      throw new DomainError(`Intervalo grande demais — gere no máximo ${MAX_RANGE_MONTHS} meses de cada vez.`);
    }

    const byMonth: { year: number; month: number; generated: number; skipped: number }[] = [];
    let generated = 0;
    let skipped = 0;
    let total = 0;

    for (let idx = startIdx; idx <= endIdx; idx++) {
      const year = Math.floor(idx / 12);
      const month = (idx % 12) + 1;
      const result = await this.generateForMonth(year, month);
      byMonth.push({ year, month, generated: result.generated, skipped: result.skipped });
      generated += result.generated;
      skipped += result.skipped;
      total = result.total;
    }

    return { total, generated, skipped, byMonth };
  },
};
