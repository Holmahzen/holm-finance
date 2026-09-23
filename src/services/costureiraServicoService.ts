import { costureiraServicoRepository } from "@/repositories/costureiraServicoRepository";
import { categoryRepository } from "@/repositories/categoryRepository";
import { counterpartyRepository } from "@/repositories/counterpartyRepository";
import { entryService } from "@/services/entryService";
import { DomainError, NotFoundError } from "@/domain/errors";
import type {
  CreateCostureiraServicoInput,
  PagarCostureiraInput,
  UpdateCostureiraDueDateInput,
} from "@/domain/schemas/costureiraServico";

const COSTURA_CATEGORY_NAME = "Costura";

async function getCosturaCategory() {
  const category = await categoryRepository.findByName(COSTURA_CATEGORY_NAME);
  if (!category) {
    throw new DomainError(`Categoria "${COSTURA_CATEGORY_NAME}" não encontrada — cadastre em Categorias.`);
  }
  return category;
}

// A maioria usa a categoria "Costura" genérica, mas algumas costureiras têm
// um tipo de serviço com categoria própria já cadastrada (ex.: "Caseado",
// pago separado há meses) — nesse caso `defaultCategoryId` na contraparte
// manda, em vez de forçar tudo em "Costura".
async function resolveCategoryFor(counterparty: { defaultCategoryId: string | null }) {
  if (counterparty.defaultCategoryId) {
    const category = await categoryRepository.findById(counterparty.defaultCategoryId);
    if (category) return category;
  }
  return getCosturaCategory();
}

async function getCounterpartyOrThrow(counterpartyId: string) {
  const counterparty = await counterpartyRepository.findById(counterpartyId);
  if (!counterparty) throw new NotFoundError("Contraparte", counterpartyId);
  return counterparty;
}

function describeEntry(categoryName: string, counterpartyName: string, count: number) {
  return `${categoryName} - ${counterpartyName} (${count} serviço${count > 1 ? "s" : ""})`;
}

async function syncEntryTotal(entryId: string, categoryName: string, counterpartyName: string) {
  const servicos = await costureiraServicoRepository.findByEntry(entryId);
  const total = servicos.reduce((sum, s) => sum + Number(s.amount), 0);
  await entryService.update(entryId, {
    amount: total,
    description: describeEntry(categoryName, counterpartyName, servicos.length),
  });
}

export const costureiraServicoService = {
  async listPending(counterpartyId: string) {
    const counterparty = await getCounterpartyOrThrow(counterpartyId);
    const category = await resolveCategoryFor(counterparty);
    const openEntry = await costureiraServicoRepository.findOpenEntry(counterpartyId, category.id);
    if (!openEntry) {
      return { entryId: null, dueDate: null, servicos: [], categoryId: category.id, categoryName: category.name };
    }
    const servicos = await costureiraServicoRepository.findByEntry(openEntry.id);
    return {
      entryId: openEntry.id,
      dueDate: openEntry.dueDate,
      servicos,
      categoryId: category.id,
      categoryName: category.name,
    };
  },

  async create(input: CreateCostureiraServicoInput) {
    const counterparty = await getCounterpartyOrThrow(input.counterpartyId);
    const category = await resolveCategoryFor(counterparty);

    const openEntry = await costureiraServicoRepository.findOpenEntry(input.counterpartyId, category.id);

    if (openEntry) {
      const servico = await costureiraServicoRepository.create({
        counterpartyId: input.counterpartyId,
        date: input.date,
        amount: input.amount,
        description: input.description,
        entryId: openEntry.id,
      });
      await syncEntryTotal(openEntry.id, category.name, counterparty.name);
      return servico;
    }

    if (!input.dueDate) {
      throw new DomainError(
        "Esse é o primeiro serviço dessa quinzena — informe a data de vencimento prevista pra esse pagamento.",
      );
    }

    const entry = await entryService.create({
      type: "PAYABLE",
      description: describeEntry(category.name, counterparty.name, 1),
      amount: input.amount,
      dueDate: input.dueDate,
      categoryId: category.id,
      counterpartyId: input.counterpartyId,
    });

    return costureiraServicoRepository.create({
      counterpartyId: input.counterpartyId,
      date: input.date,
      amount: input.amount,
      description: input.description,
      entryId: entry.id,
    });
  },

  async remove(id: string) {
    const servico = await costureiraServicoRepository.findById(id);
    if (!servico) throw new NotFoundError("Serviço de costura", id);

    if (servico.entryId) {
      const entry = await entryService.get(servico.entryId);
      if (entry.status === "PAID") {
        throw new DomainError("Este serviço já foi pago — não dá pra excluir, só remover do lançamento pago.");
      }
      await costureiraServicoRepository.delete(id);
      const remaining = await costureiraServicoRepository.findByEntry(servico.entryId);
      if (remaining.length === 0) {
        await entryService.remove(servico.entryId);
      } else {
        const counterparty = await counterpartyRepository.findById(servico.counterpartyId);
        const category = counterparty ? await resolveCategoryFor(counterparty) : null;
        await syncEntryTotal(servico.entryId, category?.name ?? COSTURA_CATEGORY_NAME, counterparty?.name ?? "");
      }
      return { ok: true };
    }

    return costureiraServicoRepository.delete(id);
  },

  async updateDueDate(counterpartyId: string, input: UpdateCostureiraDueDateInput) {
    const counterparty = await getCounterpartyOrThrow(counterpartyId);
    const category = await resolveCategoryFor(counterparty);
    const openEntry = await costureiraServicoRepository.findOpenEntry(counterpartyId, category.id);
    if (!openEntry) throw new DomainError("Nenhum serviço pendente pra essa costureira.");
    return entryService.update(openEntry.id, { dueDate: input.dueDate });
  },

  async pagar(input: PagarCostureiraInput) {
    const counterparty = await getCounterpartyOrThrow(input.counterpartyId);
    const category = await resolveCategoryFor(counterparty);
    const openEntry = await costureiraServicoRepository.findOpenEntry(input.counterpartyId, category.id);
    if (!openEntry) {
      throw new DomainError("Nenhum serviço pendente pra essa costureira.");
    }

    const total = Number(openEntry.amount);
    await entryService.pay(openEntry.id, {
      bankAccountId: input.bankAccountId,
      paidAmount: total,
      paidAt: input.paidAt,
    });

    const count = (await costureiraServicoRepository.findByEntry(openEntry.id)).length;
    return { entryId: openEntry.id, total, count };
  },
};
