import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { parseMercadoTurboWorkbook } from "@/parsers/mercadoTurbo/mercadoTurboParser";
import { parseShopeeWorkbook } from "@/parsers/shopee/shopeeParser";
import { marketplaceSaleRepository } from "@/repositories/marketplaceSaleRepository";
import { salesImportBatchRepository } from "@/repositories/salesImportBatchRepository";
import { DomainError } from "@/domain/errors";

type ParsedSales = ReturnType<typeof parseMercadoTurboWorkbook> | ReturnType<typeof parseShopeeWorkbook>;

// Cada planilha de marketplace tem um formato de coluna próprio — tenta cada
// parser em ordem e usa o primeiro que reconhecer o cabeçalho. Os parsers só
// lançam erro por formato não reconhecido (colunas faltando/sem linhas), erros
// de conteúdo (SKU/data ausente numa linha) só descartam aquela linha, não
// interrompem a tentativa — então é seguro tentar o próximo formato no catch.
function parseWorkbook(buffer: Buffer): ParsedSales {
  const parsers = [parseMercadoTurboWorkbook, parseShopeeWorkbook];
  let lastError: unknown;
  for (const parse of parsers) {
    try {
      return parse(buffer);
    } catch (err) {
      lastError = err;
    }
  }
  throw new DomainError(
    lastError instanceof Error
      ? lastError.message
      : "Não foi possível reconhecer o formato da planilha (esperado: Mercado Turbo ou Shopee).",
  );
}

export type ImportSalesResult = {
  batchId: string;
  totalRows: number;
  skippedRows: number;
  newSales: number;
  updatedSales: number;
};

export const salesImportService = {
  /**
   * Sempre reprocessa a planilha e faz upsert por número do pedido — mesmo
   * reimportando o MESMO arquivo de antes (hash idêntico), os pedidos já
   * existentes são atualizados com os valores atuais do parser, não só
   * pulados. Isso é o que permite reimportar um arquivo antigo pra corrigir
   * dados depois de um ajuste no parser (ex.: `marketplaceCost`), sem
   * precisar apagar e reimportar tudo na mão.
   */
  async importFile(fileName: string, buffer: Buffer): Promise<ImportSalesResult> {
    const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");
    const parsed = parseWorkbook(buffer);

    if (parsed.rows.length === 0) {
      throw new DomainError("Nenhuma venda reconhecida na planilha.");
    }

    const { batch, newCount, updatedCount } = await prisma.$transaction(
      async (tx) => {
        const existingBatch = await salesImportBatchRepository.findByHash(fileHash);
        const batch =
          existingBatch ??
          (await salesImportBatchRepository.create(
            { fileName, fileHash, rowCount: parsed.rows.length, importedCount: 0, duplicateCount: 0 },
            tx,
          ));

        const { newCount, updatedCount } = await marketplaceSaleRepository.upsertMany(
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
            marketplaceCost: r.marketplaceCost,
            customerName: r.customerName,
            status: r.status,
            importBatchId: batch.id,
          })),
          tx,
        );

        if (!existingBatch) {
          await salesImportBatchRepository.updateCounts(
            batch.id,
            { importedCount: newCount, duplicateCount: updatedCount },
            tx,
          );
        }

        return { batch, newCount, updatedCount };
      },
      { timeout: 120_000 },
    );

    return {
      batchId: batch.id,
      totalRows: parsed.rows.length,
      skippedRows: parsed.skippedRows,
      newSales: newCount,
      updatedSales: updatedCount,
    };
  },
};
