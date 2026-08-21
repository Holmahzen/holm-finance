import { creditCardPurchaseRepository } from "@/repositories/creditCardPurchaseRepository";
import { creditCardRepository } from "@/repositories/creditCardRepository";
import { entryRepository } from "@/repositories/entryRepository";
import { dashboardRepository } from "@/repositories/dashboardRepository";
import { DomainError, NotFoundError } from "@/domain/errors";
import { computeInstallments } from "@/domain/creditCardPurchase";
import type {
  CreateCreditCardPurchaseInput,
  UpdateCreditCardPurchaseInput,
} from "@/domain/schemas/creditCardPurchase";

export const creditCardPurchaseService = {
  list() {
    return creditCardPurchaseRepository.findMany();
  },

  async get(id: string) {
    const purchase = await creditCardPurchaseRepository.findById(id);
    if (!purchase) throw new NotFoundError("Compra no cartão", id);
    return purchase;
  },

  async create(input: CreateCreditCardPurchaseInput) {
    const card = await creditCardRepository.findById(input.creditCardId);
    if (!card) throw new NotFoundError("Cartão de crédito", input.creditCardId);

    const paidInstallments = input.paidInstallments ?? 0;
    if (paidInstallments > input.installments) {
      throw new DomainError("Parcelas já pagas não pode ser maior que o total de parcelas.");
    }

    const totalAmount = Number(input.totalAmount);
    const installmentPlan = computeInstallments(totalAmount, input.installments, input.firstDueDate);

    const purchase = await creditCardPurchaseRepository.create({
      creditCardId: input.creditCardId,
      description: input.description,
      totalAmount,
      installments: input.installments,
      purchaseDate: input.purchaseDate,
      categoryId: input.categoryId,
      counterpartyId: input.counterpartyId,
    });

    for (const installment of installmentPlan) {
      // Compra retroativa: parcelas cuja numeração já foi coberta por
      // "parcelas já pagas" entram direto como pagas (data do pagamento
      // fica igual ao vencimento — dá pra ajustar depois em Lançamentos).
      const isPaid = installment.installmentNumber <= paidInstallments;
      await entryRepository.create({
        type: "PAYABLE",
        description:
          input.installments === 1
            ? input.description
            : `${input.description} (${installment.installmentNumber}/${input.installments})`,
        amount: installment.amount,
        dueDate: installment.dueDate,
        competenceDate: input.purchaseDate,
        categoryId: input.categoryId,
        counterpartyId: input.counterpartyId,
        creditCardPurchaseId: purchase.id,
        installmentNumber: installment.installmentNumber,
        status: isPaid ? "PAID" : "PENDING",
        paidAt: isPaid ? installment.dueDate : undefined,
      });
    }

    return this.get(purchase.id);
  },

  async update(id: string, input: UpdateCreditCardPurchaseInput) {
    const existing = await this.get(id);

    if (input.creditCardId) {
      const card = await creditCardRepository.findById(input.creditCardId);
      if (!card) throw new NotFoundError("Cartão de crédito", input.creditCardId);
    }

    await creditCardPurchaseRepository.update(id, {
      creditCardId: input.creditCardId,
      description: input.description,
      categoryId: input.categoryId,
      counterpartyId: input.counterpartyId,
    });

    // As parcelas já geradas herdaram descrição/categoria/contraparte da
    // compra no momento da criação — replica a mudança pra elas também,
    // senão a DRE e os Lançamentos continuam mostrando o valor antigo.
    const newDescription = input.description ?? existing.description;
    if (input.description !== undefined || input.categoryId !== undefined || input.counterpartyId !== undefined) {
      for (const entry of existing.generatedEntries) {
        await entryRepository.update(entry.id, {
          description:
            existing.installments === 1
              ? newDescription
              : `${newDescription} (${entry.installmentNumber}/${existing.installments})`,
          categoryId: input.categoryId !== undefined ? input.categoryId : undefined,
          counterpartyId: input.counterpartyId !== undefined ? input.counterpartyId : undefined,
        });
      }
    }

    return this.get(id);
  },

  // Referência de "quanto entra por mês": média do faturamento realizado nos
  // últimos meses fechados (mesma fonte que o Dashboard Executivo usa pra
  // "Faturamento" — entradas pagas no período). Independe de cartão — o
  // comprometimento por cartão é agrupado no cliente a partir da lista de
  // compras, que já é filtrável.
  async getAverageRevenue(monthsBack = 3) {
    const now = new Date();
    let totalRevenue = 0;
    for (let i = 1; i <= monthsBack; i++) {
      const idx = now.getMonth() - i;
      const year = now.getFullYear() + Math.floor(idx / 12);
      const month = ((idx % 12) + 12) % 12 + 1;
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 1);
      const flow = await dashboardRepository.getMonthlyFlow(start, end);
      totalRevenue += Number(flow.inflow);
    }
    return { averageRevenue: monthsBack > 0 ? totalRevenue / monthsBack : 0, revenueMonthsBack: monthsBack };
  },

  async remove(id: string) {
    await this.get(id);
    // Parcelas ainda não pagas são canceladas junto com a compra; parcelas já
    // pagas são histórico real de dinheiro que já saiu, então continuam
    // existindo como lançamentos avulsos (só perdem o vínculo com a compra).
    await creditCardPurchaseRepository.deleteUnpaidEntries(id);
    await creditCardPurchaseRepository.unlinkEntries(id);
    return creditCardPurchaseRepository.delete(id);
  },
};
