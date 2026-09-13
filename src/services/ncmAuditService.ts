import { fiscalNoteRepository } from "@/repositories/fiscalNoteRepository";
import { tipiRepository } from "@/repositories/tipiRepository";
import { buildNcmAudit } from "@/domain/ncmAudit";

export const ncmAuditService = {
  async getReport() {
    const rows = await fiscalNoteRepository.findSaleItemsForNcmAudit();
    const ncms = [...new Set(rows.map((r) => r.ncm).filter((ncm) => ncm !== ""))];
    const [byNcm, tipi] = await Promise.all([tipiRepository.findByNcms(ncms), tipiRepository.getSummary()]);
    return {
      ...buildNcmAudit(rows, { loaded: tipi.count > 0, byNcm }),
      tipi,
    };
  },
};
