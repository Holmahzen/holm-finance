import { entryRepository } from "@/repositories/entryRepository";
import { NotFoundError, DomainError } from "@/domain/errors";
import type { CreateEntryInput, UpdateEntryInput, PayEntryInput } from "@/domain/schemas/entry";
import type { Prisma } from "@/generated/prisma/client";

export const entryService = {
  list(filters?: {
    status?: string;
    type?: string;
    categoryId?: string;
    year?: number;
    month?: number;
  }) {
    const where: Prisma.EntryWhereInput = {};
    if (filters?.status) where.status = filters.status as Prisma.EntryWhereInput["status"];
    if (filters?.type) where.type = filters.type as Prisma.EntryWhereInput["type"];
    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.year && filters?.month) {
      const start = new Date(filters.year, filters.month - 1, 1);
      const end = new Date(filters.year, filters.month, 1);
      where.dueDate = { gte: start, lt: end };
    }
    return entryRepository.findMany(where);
  },

  async get(id: string) {
    const entry = await entryRepository.findById(id);
    if (!entry) throw new NotFoundError("Lançamento", id);
    return entry;
  },

  create(input: CreateEntryInput) {
    return entryRepository.create(input);
  },

  async update(id: string, input: UpdateEntryInput) {
    await this.get(id);
    return entryRepository.update(id, input);
  },

  async remove(id: string) {
    await this.get(id);
    await entryRepository.deleteReconciliationMatchForEntry(id);
    return entryRepository.delete(id);
  },

  async pay(id: string, input: PayEntryInput) {
    const entry = await this.get(id);
    if (entry.status !== "PENDING") {
      throw new DomainError(`Lançamento já está com status ${entry.status}.`);
    }

    return entryRepository.update(id, {
      status: "PAID",
      paidAt: input.paidAt,
      paidAmount: input.paidAmount ?? entry.amount,
      bankAccountId: input.bankAccountId,
    });
  },
};
