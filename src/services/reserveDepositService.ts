import { reserveDepositRepository } from "@/repositories/reserveDepositRepository";
import { NotFoundError } from "@/domain/errors";
import type { CreateReserveDepositInput } from "@/domain/schemas/reserveDeposit";

export const reserveDepositService = {
  list() {
    return reserveDepositRepository.findMany();
  },

  create(input: CreateReserveDepositInput) {
    return reserveDepositRepository.create(input);
  },

  async remove(id: string) {
    const existing = await reserveDepositRepository.findById(id);
    if (!existing) throw new NotFoundError("Depósito de reserva", id);
    return reserveDepositRepository.delete(id);
  },
};
