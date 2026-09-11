import { fiscalNoteRepository } from "@/repositories/fiscalNoteRepository";
import { buildNcmAudit } from "@/domain/ncmAudit";

export const ncmAuditService = {
  async getReport() {
    return buildNcmAudit(await fiscalNoteRepository.findSaleItemsForNcmAudit());
  },
};
