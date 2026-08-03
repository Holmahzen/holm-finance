import { loanRepository } from "@/repositories/loanRepository";
import { NotFoundError } from "@/domain/errors";
import type { CreateLoanInput, UpdateLoanInput } from "@/domain/schemas/loan";

export const loanService = {
  list() {
    return loanRepository.findMany();
  },

  async get(id: string) {
    const loan = await loanRepository.findById(id);
    if (!loan) throw new NotFoundError("Empréstimo", id);
    return loan;
  },

  create(input: CreateLoanInput) {
    return loanRepository.create(input);
  },

  async update(id: string, input: UpdateLoanInput) {
    await this.get(id);
    return loanRepository.update(id, input);
  },

  async remove(id: string) {
    await this.get(id);
    return loanRepository.delete(id);
  },
};
