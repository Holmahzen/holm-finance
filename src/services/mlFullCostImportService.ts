import { parseMlFullCostWorkbook } from "@/parsers/mercadoLivreFull/mlFullCostParser";
import { mlFullCostRepository } from "@/repositories/mlFullCostRepository";
import { DomainError } from "@/domain/errors";

export type ImportMlFullCostResult = {
  totalRows: number;
  skippedRows: number;
  newRows: number;
  updatedRows: number;
};

export const mlFullCostImportService = {
  async importFile(buffer: Buffer): Promise<ImportMlFullCostResult> {
    let parsed: ReturnType<typeof parseMlFullCostWorkbook>;
    try {
      parsed = parseMlFullCostWorkbook(buffer);
    } catch (err) {
      throw new DomainError(err instanceof Error ? err.message : "Falha ao ler o Relatório de Tarifas Full.");
    }

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
    );

    return {
      totalRows: parsed.rows.length,
      skippedRows: parsed.skippedRows,
      newRows: newCount,
      updatedRows: updatedCount,
    };
  },
};
