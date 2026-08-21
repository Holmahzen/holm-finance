import { creditCardRepository } from "@/repositories/creditCardRepository";
import { NotFoundError } from "@/domain/errors";
import type { CreateCreditCardInput, UpdateCreditCardInput } from "@/domain/schemas/creditCard";

export const creditCardService = {
  list() {
    return creditCardRepository.findMany();
  },

  listActive() {
    return creditCardRepository.findActive();
  },

  async get(id: string) {
    const card = await creditCardRepository.findById(id);
    if (!card) throw new NotFoundError("Cartão de crédito", id);
    return card;
  },

  create(input: CreateCreditCardInput) {
    return creditCardRepository.create(input);
  },

  async update(id: string, input: UpdateCreditCardInput) {
    await this.get(id);
    return creditCardRepository.update(id, input);
  },
};
