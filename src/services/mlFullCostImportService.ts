import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { parseMlFullCostWorkbook } from "@/parsers/mercadoLivreFull/mlFullCostParser";
import { mlFullCostRepository } from "@/repositories/mlFullCostRepository";
import { mlFullCostImportBatchRepository } from "@/repositories/mlFullCostImportBatchRepository";
import { DomainError } from "@/domain/errors";

export type ImportMlFullCostResult = {
  totalRows: number;
  skippedRows: number;
  newRows: number;
  updatedRows: number;
};

export const mlFullCostImportService = {
  /** Reimportar o MESMO arquivo (hash idêntico) reaproveita o batch já registrado em vez de duplicar o histórico — mesmo padrão do salesImportService. */
  async importFile(fileName: string, buffer: Buffer): Promise<ImportMlFullCostResult> {
    const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");

    let parsed: ReturnType<typeof parseMlFullCostWorkbook>;
    try {
      parsed = parseMlFullCostWorkbook(buffer);
    } catch (err) {
      throw new DomainError(err instanceof Error ? err.message : "Falha ao ler o Relatório de Tarifas Full.");
    }

    const { newCount, updatedCount } = await prisma.$transaction(
      async (tx) => {
        const existingBatch = await mlFullCostImportBatchRepository.findByHash(fileHash);
        const batch =
          existingBatch ??
          (await mlFullCostImportBatchRepository.create(
            { fileName, fileHash, rowCount: parsed.rows.length, importedCount: 0, duplicateCount: 0 },
            tx,
          ));

        const { newCount, updatedCount } = await mlFullCostRepository.upsertMany(
          parsed.rows.map((r) => ({
            type: r.type,
            costNumber: r.costNumber,
            costDate: r.costDate,
            sku: r.sku,
            listingCode: r.listingCode,
            amount: r.amount,
            details: r.details,
          })),
          tx,
        );

        if (!existingBatch) {
          await mlFullCostImportBatchRepository.updateCounts(batch.id, { importedCount: newCount, duplicateCount: updatedCount }, tx);
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
