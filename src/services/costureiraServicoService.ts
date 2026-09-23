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

function describeEntry(counterpartyName: string, count: number) {
  return `Costura - ${counterpartyName} (${count} serviço${count > 1 ? "s" : ""})`;
}

async function syncEntryTotal(entryId: string, counterpartyName: string) {
  const servicos = await costureiraServicoRepository.findByEntry(entryId);
  const total = servicos.reduce((sum, s) => sum + Number(s.amount), 0);
  await entryService.update(entryId, {
    amount: total,
    description: describeEntry(counterpartyName, servicos.length),
  });
}

export const costureiraServicoService = {
  async listPending(counterpartyId: string) {
    const category = await getCosturaCategory();
    const openEntry = await costureiraServicoRepository.findOpenEntry(counterpartyId, category.id);
    if (!openEntry) return [];
    return costureiraServicoRepository.findByEntry(openEntry.id);
  },

  // Visão agrupada — todas as costureiras com pendência, cada uma com seu
  // Entry (e vencimento) e a lista de serviços que compõem aquele valor.
  async listAllPendingGrouped() {
    const category = await getCosturaCategory();
    const servicos = await costureiraServicoRepository.findAllPending(category.id);

    const groups = new Map<
      string,
      {
        counterpartyId: string;
        counterpartyName: string;
        entryId: string;
        dueDate: Date;
        total: number;
        servicos: { id: string; date: Date; amount: number; description: string | null }[];
      }
    >();

    for (const s of servicos) {
      if (!s.entry) continue;
      let group = groups.get(s.counterpartyId);
      if (!group) {
        group = {
          counterpartyId: s.counterpartyId,
          counterpartyName: s.counterparty.name,
          entryId: s.entry.id,
          dueDate: s.entry.dueDate,
          total: 0,
          servicos: [],
        };
        groups.set(s.counterpartyId, group);
      }
      group.total += Number(s.amount);
      group.servicos.push({ id: s.id, date: s.date, amount: Number(s.amount), description: s.description });
    }

    return Array.from(groups.values()).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  },

  async create(input: CreateCostureiraServicoInput) {
    const category = await getCosturaCategory();
    const counterparty = await counterpartyRepository.findById(input.counterpartyId);
    if (!counterparty) throw new NotFoundError("Contraparte", input.counterpartyId);

    const openEntry = await costureiraServicoRepository.findOpenEntry(input.counterpartyId, category.id);

    if (openEntry) {
      const servico = await costureiraServicoRepository.create({
        counterpartyId: input.counterpartyId,
        date: input.date,
        amount: input.amount,
        description: input.description,
        entryId: openEntry.id,
      });
      await syncEntryTotal(openEntry.id, counterparty.name);
      return servico;
    }

    if (!input.dueDate) {
      throw new DomainError(
        "Esse é o primeiro serviço dessa quinzena — informe a data de vencimento prevista pra esse pagamento.",
      );
    }

    const entry = await entryService.create({
      type: "PAYABLE",
      description: describeEntry(counterparty.name, 1),
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
        await syncEntryTotal(servico.entryId, counterparty?.name ?? "");
      }
      return { ok: true };
    }

    return costureiraServicoRepository.delete(id);
  },

  async updateDueDate(counterpartyId: string, input: UpdateCostureiraDueDateInput) {
    const category = await getCosturaCategory();
    const openEntry = await costureiraServicoRepository.findOpenEntry(counterpartyId, category.id);
    if (!openEntry) throw new DomainError("Nenhum serviço pendente pra essa costureira.");
    return entryService.update(openEntry.id, { dueDate: input.dueDate });
  },

  async pagar(input: PagarCostureiraInput) {
    const category = await getCosturaCategory();
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
