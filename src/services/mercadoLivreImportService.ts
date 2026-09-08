import { prisma } from "@/lib/prisma";
import { parseMercadoLivreWorkbook } from "@/parsers/mercadoLivre/mercadoLivreParser";
import { mercadoLivreSaleRepository } from "@/repositories/mercadoLivreSaleRepository";
import { estimateReleaseDate } from "@/domain/mercadoLivreReleases";
import { DomainError } from "@/domain/errors";

export type ImportMercadoLivreResult = {
  totalRows: number;
  skippedRows: number;
  newSales: number;
  updatedSales: number;
  withDeliveryDate: number;
};

export const mercadoLivreImportService = {
  /**
   * Importa o relatório de vendas exportado direto do Mercado Livre, numa
   * tabela separada das vendas do Mercado Turbo/Shopee. Os dois relatórios
   * cobrem os mesmos pedidos com contas incompatíveis (margem de contribuição
   * versus líquido do marketplace), então misturá-los faria a DRE ler um pelo
   * outro — ver o comentário do model `MercadoLivreSale`.
   */
  async importFile(buffer: Buffer): Promise<ImportMercadoLivreResult> {
    const parsed = parseMercadoLivreWorkbook(buffer);

    if (parsed.rows.length === 0) {
      throw new DomainError("Nenhuma venda reconhecida na planilha.");
    }

    const { newCount, updatedCount } = await prisma.$transaction(
      (tx) =>
        mercadoLivreSaleRepository.upsertMany(
          parsed.rows.map((r) => ({
            orderId: r.orderId,
            saleDate: r.saleDate,
            sku: r.sku,
            productName: r.productName,
            status: r.status,
            shippingModality: r.shippingModality,
            customerName: r.customerName,
            quantity: r.quantity,
            grossRevenue: r.grossRevenue,
            netTotal: r.netTotal,
            deliveredAt: r.deliveredAt,
            releaseDate: r.deliveredAt ? estimateReleaseDate(r.deliveredAt) : null,
            billingMonth: r.billingMonth,
          })),
          tx,
        ),
      { timeout: 300_000 },
    );

    return {
      totalRows: parsed.rows.length,
      skippedRows: parsed.skippedRows,
      newSales: newCount,
      updatedSales: updatedCount,
      withDeliveryDate: parsed.rows.filter((r) => r.deliveredAt !== null).length,
    };
  },
};
