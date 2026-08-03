import { mercadoLivreReceivableRepository } from "@/repositories/mercadoLivreReceivableRepository";
import type { UpdateMercadoLivreReceivableInput } from "@/domain/schemas/mercadoLivreReceivable";

export const mercadoLivreReceivableService = {
  async get() {
    const existing = await mercadoLivreReceivableRepository.findFirst();
    if (existing) return existing;
    return mercadoLivreReceivableRepository.create();
  },

  async update(input: UpdateMercadoLivreReceivableInput) {
    const record = await this.get();
    return mercadoLivreReceivableRepository.update(record.id, input);
  },
};
