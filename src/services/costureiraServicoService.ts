import { costureiraServicoRepository } from "@/repositories/costureiraServicoRepository";
import { categoryRepository } from "@/repositories/categoryRepository";
import { counterpartyRepository } from "@/repositories/counterpartyRepository";
import { entryService } from "@/services/entryService";
import { DomainError, NotFoundError } from "@/domain/errors";
import type { CreateCostureiraServicoInput, PagarCostureiraInput } from "@/domain/schemas/costureiraServico";

const COSTURA_CATEGORY_NAME = "Costura";

export const costureiraServicoService = {
  listPending(counterpartyId: string) {
    return costureiraServicoRepository.findPending(counterpartyId);
  },

  create(input: CreateCostureiraServicoInput) {
    return costureiraServicoRepository.create(input);
  },

  async remove(id: string) {
    const servico = await costureiraServicoRepository.findById(id);
    if (!servico) throw new NotFoundError("Serviço de costura", id);
    if (servico.paidEntryId) {
      throw new DomainError("Este serviço já foi pago — não dá pra excluir, só remover do lançamento pago.");
    }
    return costureiraServicoRepository.delete(id);
  },

  async pagar(input: PagarCostureiraInput) {
    const pendentes = await costureiraServicoRepository.findPending(input.counterpartyId);
    if (pendentes.length === 0) {
      throw new DomainError("Nenhum serviço pendente pra essa costureira.");
    }

    const counterparty = await counterpartyRepository.findById(input.counterpartyId);
    if (!counterparty) throw new NotFoundError("Contraparte", input.counterpartyId);

    const category = await categoryRepository.findByName(COSTURA_CATEGORY_NAME);
    if (!category) {
      throw new DomainError(`Categoria "${COSTURA_CATEGORY_NAME}" não encontrada — cadastre em Categorias.`);
    }

    const total = pendentes.reduce((sum, s) => sum + Number(s.amount), 0);

    const entry = await entryService.create({
      type: "PAYABLE",
      description: `Costura - ${counterparty.name} (${pendentes.length} serviço${pendentes.length > 1 ? "s" : ""})`,
      amount: total,
      dueDate: input.paidAt,
      categoryId: category.id,
      counterpartyId: input.counterpartyId,
    });

    await entryService.pay(entry.id, { bankAccountId: input.bankAccountId, paidAmount: total, paidAt: input.paidAt });

    await costureiraServicoRepository.markPaid(
      pendentes.map((s) => s.id),
      entry.id,
    );

    return { entryId: entry.id, total, count: pendentes.length };
  },
};
