import { z } from "zod";

export const createCreditCardSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
});

export const updateCreditCardSchema = createCreditCardSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateCreditCardInput = z.infer<typeof createCreditCardSchema>;
export type UpdateCreditCardInput = z.infer<typeof updateCreditCardSchema>;
