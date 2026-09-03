import { balanceSheetItemRepository } from "@/repositories/balanceSheetItemRepository";
import { NotFoundError } from "@/domain/errors";
import type {
  CreateBalanceSheetItemInput,
  UpdateBalanceSheetItemInput,
} from "@/domain/schemas/balanceSheetItem";

export const balanceSheetItemService = {
  list() {
    return balanceSheetItemRepository.findMany();
  },

  async get(id: string) {
    const item = await balanceSheetItemRepository.findById(id);
    if (!item) throw new NotFoundError("Item do balanço patrimonial", id);
    return item;
  },

  create(input: CreateBalanceSheetItemInput) {
    return balanceSheetItemRepository.create(input);
  },

  async update(id: string, input: UpdateBalanceSheetItemInput) {
    await this.get(id);
    return balanceSheetItemRepository.update(id, input);
  },

  async remove(id: string) {
    await this.get(id);
    return balanceSheetItemRepository.delete(id);
  },
};
