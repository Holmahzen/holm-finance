import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { parseMlAdsWorkbook } from "@/parsers/mercadoLivreAds/mlAdsParser";
import { mlAdSpendRepository } from "@/repositories/mlAdSpendRepository";
import { mlAdSpendImportBatchRepository } from "@/repositories/mlAdSpendImportBatchRepository";
import { DomainError } from "@/domain/errors";

export type ImportMlAdsResult = {
  totalRows: number;
  skippedRows: number;
  newRows: number;
  updatedRows: number;
};

export const mlAdsImportService = {
  /** Reimportar o MESMO arquivo (hash idêntico) reaproveita o batch já registrado em vez de duplicar o histórico — mesmo padrão do salesImportService. */
  async importFile(fileName: string, buffer: Buffer): Promise<ImportMlAdsResult> {
    const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");

    let parsed: ReturnType<typeof parseMlAdsWorkbook>;
    try {
      parsed = parseMlAdsWorkbook(buffer);
    } catch (err) {
      throw new DomainError(err instanceof Error ? err.message : "Falha ao ler o relatório de Ads.");
    }

    const { newCount, updatedCount } = await prisma.$transaction(
      async (tx) => {
        const existingBatch = await mlAdSpendImportBatchRepository.findByHash(fileHash);
        const batch =
          existingBatch ??
          (await mlAdSpendImportBatchRepository.create(
            { fileName, fileHash, rowCount: parsed.rows.length, importedCount: 0, duplicateCount: 0 },
            tx,
          ));

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
          tx,
        );

        if (!existingBatch) {
          await mlAdSpendImportBatchRepository.updateCounts(batch.id, { importedCount: newCount, duplicateCount: updatedCount }, tx);
        }

        return { newCount, updatedCount };
      },
      { timeout: 120_000 },
    );

    return {
      totalRows: parsed.rows.length,
      skippedRows: parsed.skippedRows,
      newRows: newCount,
      updatedRows: updatedCount,
    };
  },
};
