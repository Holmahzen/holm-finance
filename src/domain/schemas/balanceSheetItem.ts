import { z } from "zod";

export const balanceSheetSectionSchema = z.enum([
  "ATIVO_CIRCULANTE",
  "ATIVO_NAO_CIRCULANTE",
  "PASSIVO_CIRCULANTE",
  "PASSIVO_NAO_CIRCULANTE",
  "PATRIMONIO_LIQUIDO",
]);

export const createBalanceSheetItemSchema = z.object({
  section: balanceSheetSectionSchema,
  description: z.string().min(1, "Descrição é obrigatória"),
  amount: z.union([z.string(), z.number()]),
});

export const updateBalanceSheetItemSchema = createBalanceSheetItemSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateBalanceSheetItemInput = z.infer<typeof createBalanceSheetItemSchema>;
export type UpdateBalanceSheetItemInput = z.infer<typeof updateBalanceSheetItemSchema>;
