import { parseMlAdsWorkbook } from "@/parsers/mercadoLivreAds/mlAdsParser";
import { mlAdSpendRepository } from "@/repositories/mlAdSpendRepository";
import { DomainError } from "@/domain/errors";

export type ImportMlAdsResult = {
  totalRows: number;
  skippedRows: number;
  newRows: number;
  updatedRows: number;
};

export const mlAdsImportService = {
  async importFile(buffer: Buffer): Promise<ImportMlAdsResult> {
    let parsed: ReturnType<typeof parseMlAdsWorkbook>;
    try {
      parsed = parseMlAdsWorkbook(buffer);
    } catch (err) {
      throw new DomainError(err instanceof Error ? err.message : "Falha ao ler o relatório de Ads.");
    }

    const { newCount, updatedCount } = await mlAdSpendRepository.upsertMany(
      parsed.rows.map((r) => ({
        listingCode: r.listingCode,
        adTitle: r.adTitle,
        campaignName: r.campaignName,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        investimento: r.investimento,
        receita: r.receita,
        cliques: r.cliques,
        impressoes: r.impressoes,
      })),
    );

    return {
      totalRows: parsed.rows.length,
      skippedRows: parsed.skippedRows,
      newRows: newCount,
      updatedRows: updatedCount,
    };
  },
};
