import { z } from "zod";

export const createCostureiraServicoSchema = z.object({
  counterpartyId: z.string().min(1, "Costureira é obrigatória"),
  date: z.coerce.date(),
  amount: z.union([z.string(), z.number()]),
  description: z.string().optional(),
  // Só é exigido quando é o 1º serviço depois do último fechamento — é o que
  // cria o Entry PENDENTE que vira a previsão no Fluxo de Caixa.
  dueDate: z.coerce.date().optional(),
});

export const pagarCostureiraSchema = z.object({
  counterpartyId: z.string().min(1, "Costureira é obrigatória"),
  bankAccountId: z.string().min(1, "Conta é obrigatória"),
  paidAt: z.coerce.date(),
});

export const updateCostureiraDueDateSchema = z.object({
  dueDate: z.coerce.date(),
});

export type CreateCostureiraServicoInput = z.infer<typeof createCostureiraServicoSchema>;
export type PagarCostureiraInput = z.infer<typeof pagarCostureiraSchema>;
export type UpdateCostureiraDueDateInput = z.infer<typeof updateCostureiraDueDateSchema>;
