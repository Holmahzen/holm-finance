import { counterpartyRepository } from "@/repositories/counterpartyRepository";
import { NotFoundError } from "@/domain/errors";
import type {
  CreateCounterpartyInput,
  UpdateCounterpartyInput,
} from "@/domain/schemas/counterparty";

export const counterpartyService = {
  list() {
    return counterpartyRepository.findMany();
  },

  async get(id: string) {
    const counterparty = await counterpartyRepository.findById(id);
    if (!counterparty) throw new NotFoundError("Contraparte", id);
    return counterparty;
  },

  create(input: CreateCounterpartyInput) {
    return counterpartyRepository.create(input);
  },

  async update(id: string, input: UpdateCounterpartyInput) {
    await this.get(id);
    return counterpartyRepository.update(id, input);
  },
};
