import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  sku: z.string().optional(),
  salePrice: z.union([z.string(), z.number()]),
  tecidoCost: z.union([z.string(), z.number()]).optional(),
  costuraCost: z.union([z.string(), z.number()]).optional(),
  aviamentosCost: z.union([z.string(), z.number()]).optional(),
  marketplaceFee: z.union([z.string(), z.number()]).optional(),
  shippingCost: z.union([z.string(), z.number()]).optional(),
  packagingCost: z.union([z.string(), z.number()]).optional(),
  avgMonthlyQuantity: z.coerce.number().int().min(0).optional(),
});

export const updateProductSchema = createProductSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
