import { z } from "zod";

export const createLoanSchema = z.object({
  description: z.string().min(1, "Descrição é obrigatória"),
  principal: z.union([z.string(), z.number()]),
  monthlyRatePercent: z.union([z.string(), z.number()]),
  installments: z.coerce.number().int().min(1, "Precisa de pelo menos 1 parcela"),
  matchText: z.string().min(1, "Texto de identificação é obrigatório"),
  categoryId: z.string().min(1, "Categoria é obrigatória"),
});

export const updateLoanSchema = createLoanSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateLoanInput = z.infer<typeof createLoanSchema>;
export type UpdateLoanInput = z.infer<typeof updateLoanSchema>;
