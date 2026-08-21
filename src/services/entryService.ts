import { entryRepository } from "@/repositories/entryRepository";
import { NotFoundError, DomainError } from "@/domain/errors";
import type { CreateEntryInput, UpdateEntryInput, PayEntryInput, BulkPayEntryInput } from "@/domain/schemas/entry";
import type { Prisma } from "@/generated/prisma/client";

type EntryWithCardRelations = {
  fixedCost?: { creditCard: { id: string; name: string } | null } | null;
  creditCardPurchase?: { creditCard: { id: string; name: string } | null } | null;
  [key: string]: unknown;
};

// O cartão de um lançamento vem de um dos dois caminhos possíveis (compra
// avulsa no cartão, ou custo fixo marcado com um cartão) — nunca os dois ao
// mesmo tempo. Normaliza pra um único campo `creditCard`, já que quem usa a
// tela não precisa saber por qual caminho veio.
function withNormalizedCreditCard<T extends EntryWithCardRelations>(entry: T) {
  const { fixedCost, creditCardPurchase, ...rest } = entry;
  return {
    ...rest,
    fixedCost,
    creditCardPurchase,
    creditCard: creditCardPurchase?.creditCard ?? fixedCost?.creditCard ?? null,
  };
}

export const entryService = {
  async list(filters?: {
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
    const entries = await entryRepository.findMany(where);
    return entries.map(withNormalizedCreditCard);
  },

  async get(id: string) {
    const entry = await entryRepository.findById(id);
    if (!entry) throw new NotFoundError("Lançamento", id);
    return withNormalizedCreditCard(entry);
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

  /**
   * Marca vários lançamentos como pagos de uma vez, com a mesma conta e data
   * — o caso de uso é uma fatura de cartão que sai num débito só, mas cobre
   * várias parcelas/custos fixos lançados separadamente. Ignora silenciosamente
   * quem não está mais PENDING (pode ter sido pago por outro caminho nesse
   * meio-tempo) em vez de falhar tudo por causa de um item.
   */
  async payMany(input: BulkPayEntryInput) {
    let paid = 0;
    let skipped = 0;
    for (const id of input.ids) {
      const entry = await entryRepository.findById(id);
      if (!entry || entry.status !== "PENDING") {
        skipped++;
        continue;
      }
      await entryRepository.update(id, {
        status: "PAID",
        paidAt: input.paidAt,
        paidAmount: entry.amount,
        bankAccountId: input.bankAccountId,
      });
      paid++;
    }
    return { paid, skipped };
  },
};
