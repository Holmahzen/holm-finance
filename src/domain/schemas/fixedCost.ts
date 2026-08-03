import { z } from "zod";
import { entryTypeSchema } from "./category";

export const createFixedCostSchema = z.object({
  type: entryTypeSchema.default("PAYABLE"),
  description: z.string().min(1, "Descrição é obrigatória"),
  amount: z.union([z.string(), z.number()]),
  dueDay: z.coerce.number().int().min(1, "Dia inválido").max(31, "Dia inválido"),
  categoryId: z.string().optional(),
  counterpartyId: z.string().optional(),
});

export const updateFixedCostSchema = createFixedCostSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const generateFixedCostsSchema = z.object({
  year: z.coerce.number().int(),
  month: z.coerce.number().int().min(1).max(12),
  endYear: z.coerce.number().int().optional(),
  endMonth: z.coerce.number().int().min(1).max(12).optional(),
});

export type CreateFixedCostInput = z.infer<typeof createFixedCostSchema>;
export type UpdateFixedCostInput = z.infer<typeof updateFixedCostSchema>;
export type GenerateFixedCostsInput = z.infer<typeof generateFixedCostsSchema>;
