import { accountRepository } from "@/repositories/accountRepository";
import { NotFoundError, DomainError } from "@/domain/errors";
import type { CreateAccountInput, UpdateAccountInput } from "@/domain/schemas/account";

export const accountService = {
  list() {
    return accountRepository.findMany();
  },

  async get(id: string) {
    const account = await accountRepository.findById(id);
    if (!account) throw new NotFoundError("Conta", id);
    return account;
  },

  create(input: CreateAccountInput) {
    return accountRepository.create({
      name: input.name,
      type: input.type,
      bankId: input.bankId,
      acctId: input.acctId,
      acctType: input.acctType,
      currency: input.currency,
      openingBalance: input.openingBalance,
      openingBalanceDate: input.openingBalanceDate,
    });
  },

  async update(id: string, input: UpdateAccountInput) {
    await this.get(id);
    return accountRepository.update(id, input);
  },

  async remove(id: string) {
    await this.get(id);
    const usage = await accountRepository.countUsage(id);
    if (usage > 0) {
      throw new DomainError(
        "Não é possível excluir: esta conta tem lançamentos ou importações vinculados. Desative a conta em vez de excluir.",
      );
    }
    return accountRepository.delete(id);
  },
};
