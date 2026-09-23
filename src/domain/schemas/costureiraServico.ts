import { z } from "zod";

export const createCostureiraServicoSchema = z.object({
  counterpartyId: z.string().min(1, "Costureira é obrigatória"),
  date: z.coerce.date(),
  amount: z.union([z.string(), z.number()]),
  description: z.string().optional(),
});

export const pagarCostureiraSchema = z.object({
  counterpartyId: z.string().min(1, "Costureira é obrigatória"),
  bankAccountId: z.string().min(1, "Conta é obrigatória"),
  paidAt: z.coerce.date(),
});

export type CreateCostureiraServicoInput = z.infer<typeof createCostureiraServicoSchema>;
export type PagarCostureiraInput = z.infer<typeof pagarCostureiraSchema>;
