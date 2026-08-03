import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { parseMercadoTurboWorkbook } from "@/parsers/mercadoTurbo/mercadoTurboParser";
import { marketplaceSaleRepository } from "@/repositories/marketplaceSaleRepository";
import { salesImportBatchRepository } from "@/repositories/salesImportBatchRepository";
import { DomainError } from "@/domain/errors";

export type ImportSalesResult = {
  batchId: string;
  alreadyImported: boolean;
  totalRows: number;
  skippedRows: number;
  newSales: number;
  duplicateSales: number;
};

export const salesImportService = {
  async importFile(fileName: string, buffer: Buffer): Promise<ImportSalesResult> {
    const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");

    const existingBatch = await salesImportBatchRepository.findByHash(fileHash);
    if (existingBatch) {
      return {
        batchId: existingBatch.id,
        alreadyImported: true,
        totalRows: existingBatch.rowCount,
        skippedRows: 0,
        newSales: 0,
        duplicateSales: existingBatch.importedCount,
      };
    }

    let parsed: ReturnType<typeof parseMercadoTurboWorkbook>;
    try {
      parsed = parseMercadoTurboWorkbook(buffer);
    } catch (err) {
      throw new DomainError(err instanceof Error ? err.message : "Falha ao ler a planilha.");
    }

    if (parsed.rows.length === 0) {
      throw new DomainError("Nenhuma venda reconhecida na planilha.");
    }

    const { batch, newCount } = await prisma.$transaction(async (tx) => {
      const batch = await salesImportBatchRepository.create(
        {
          fileName,
          fileHash,
          rowCount: parsed.rows.length,
          importedCount: 0,
          duplicateCount: 0,
        },
        tx,
      );

      const createResult = await marketplaceSaleRepository.createMany(
        parsed.rows.map((r) => ({
          orderId: r.orderId,
          saleDate: r.saleDate,
          sku: r.sku,
          productName: r.productName,
          channel: r.channel,
          shippingModality: r.shippingModality,
          quantity: r.quantity,
          grossRevenue: r.grossRevenue,
          netRevenue: r.netRevenue,
          customerName: r.customerName,
          status: r.status,
          importBatchId: batch.id,
        })),
        tx,
      );

      const newCount = createResult.count;
      const duplicateCount = parsed.rows.length - newCount;

      await salesImportBatchRepository.updateCounts(batch.id, { importedCount: newCount, duplicateCount }, tx);

      return { batch, newCount };
    }, { timeout: 120_000 });

    return {
      batchId: batch.id,
      alreadyImported: false,
      totalRows: parsed.rows.length,
      skippedRows: parsed.skippedRows,
      newSales: newCount,
      duplicateSales: parsed.rows.length - newCount,
    };
  },
};
