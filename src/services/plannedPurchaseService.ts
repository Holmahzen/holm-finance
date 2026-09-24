import { plannedPurchaseRepository } from "@/repositories/plannedPurchaseRepository";
import { categoryRepository } from "@/repositories/categoryRepository";
import { counterpartyRepository } from "@/repositories/counterpartyRepository";
import { entryService } from "@/services/entryService";
import { DomainError, NotFoundError } from "@/domain/errors";
import { addMonthsUTC, splitInstallments } from "@/domain/plannedPurchase";
import type { CreatePlannedPurchaseInput } from "@/domain/schemas/plannedPurchase";

const LABELS = { TECIDO: "Tecido", AVIAMENTOS: "Aviamentos", OUTRO: "Compra" } as const;

export const plannedPurchaseService = {
  list() {
    return plannedPurchaseRepository.findMany();
  },

  async create(input: CreatePlannedPurchaseInput) {
    const categoryName = input.type === "OUTRO" ? null : LABELS[input.type];
    const category = categoryName ? await categoryRepository.findByName(categoryName) : null;
    const counterparty = input.counterpartyId
      ? await counterpartyRepository.findById(input.counterpartyId)
      : null;
    if (input.counterpartyId && !counterparty) {
      throw new NotFoundError("Contraparte", input.counterpartyId);
    }

    const label = input.label ?? LABELS[input.type];
    const purchase = await plannedPurchaseRepository.create({
      kind: "MATERIAL",
      label: counterparty ? `${label} (${counterparty.name})` : label,
      categoryId: category?.id,
      counterpartyId: input.counterpartyId,
      amount: input.amount,
      dueDate: input.dueDate,
      installments: input.installments,
    });

    if (input.costuraAmount && input.costuraDueDate) {
      await plannedPurchaseRepository.create({
        kind: "COSTURA",
        label: "Costura estimada",
        categoryId: (await categoryRepository.findByName("Costura"))?.id,
        amount: input.costuraAmount,
        dueDate: input.costuraDueDate,
        installments: 1,
        parentId: purchase.id,
      });
    }

    return purchase;
  },

  async remove(id: string) {
    const item = await plannedPurchaseRepository.findById(id);
    if (!item) throw new NotFoundError("Compra planejada", id);
    // Remover a compra remove também a costura estimada que veio dela.
    if (item.kind === "MATERIAL") {
      const all = await plannedPurchaseRepository.findMany();
      for (const child of all.filter((p) => p.parentId === id)) {
        await plannedPurchaseRepository.delete(child.id);
      }
    }
    return plannedPurchaseRepository.delete(id);
  },

  /**
   * Compra de verdade: vira lançamento(s) pendente(s) reais, um por parcela.
   * A costura estimada NÃO é confirmada junto — segue como estimativa até os
   * serviços das costureiras serem lançados de fato.
   */
  async confirm(id: string) {
    const item = await plannedPurchaseRepository.findById(id);
    if (!item) throw new NotFoundError("Compra planejada", id);
    if (item.kind !== "MATERIAL") {
      throw new DomainError("Só a compra pode ser confirmada — a costura estimada é lançada em Pagamento de Costureiras.");
    }

    const parts = splitInstallments(Number(item.amount), item.installments);
    const created = [];
    for (let i = 0; i < parts.length; i++) {
      created.push(
        await entryService.create({
          type: "PAYABLE",
          description: parts.length > 1 ? `${item.label} (${i + 1}/${parts.length})` : item.label,
          amount: parts[i],
          dueDate: addMonthsUTC(item.dueDate, i),
          categoryId: item.categoryId ?? undefined,
          counterpartyId: item.counterpartyId ?? undefined,
        }),
      );
    }

    await plannedPurchaseRepository.delete(id);
    return created;
  },
};
