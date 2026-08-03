import { productRepository } from "@/repositories/productRepository";
import { NotFoundError } from "@/domain/errors";
import type { CreateProductInput, UpdateProductInput } from "@/domain/schemas/product";
import type { ParsedProductRow } from "@/domain/bulkProductPaste";

export const productService = {
  list() {
    return productRepository.findMany();
  },

  async get(id: string) {
    const product = await productRepository.findById(id);
    if (!product) throw new NotFoundError("Produto", id);
    return product;
  },

  create(input: CreateProductInput) {
    return productRepository.create(input);
  },

  async update(id: string, input: UpdateProductInput) {
    await this.get(id);
    return productRepository.update(id, input);
  },

  /** Pra cada linha colada, diz se vai criar um produto novo ou atualizar um existente (por SKU). */
  async previewBulkUpsert(rows: ParsedProductRow[]) {
    return Promise.all(
      rows.map(async (row) => {
        const existing = await productRepository.findBySku(row.sku);
        return { ...row, action: existing ? ("update" as const) : ("create" as const) };
      }),
    );
  },

  async applyBulkUpsert(rows: ParsedProductRow[]) {
    let created = 0;
    let updated = 0;

    for (const row of rows) {
      const existing = await productRepository.findBySku(row.sku);
      const fields = {
        name: row.name,
        salePrice: row.salePrice,
        tecidoCost: row.tecidoCost,
        costuraCost: row.costuraCost,
        aviamentosCost: row.aviamentosCost,
      };
      if (existing) {
        await productRepository.update(existing.id, fields);
        updated++;
      } else {
        await productRepository.create({ ...fields, sku: row.sku });
        created++;
      }
    }

    return { created, updated, total: rows.length };
  },
};
