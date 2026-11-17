import { z } from "zod";

export const createCostureiraServicoSchema = z.object({
  counterpartyId: z.string().min(1, "Costureira é obrigatória"),
  date: z.coerce.date(),
  amount: z.union([z.string(), z.number()]),
  description: z.string().optional(),
  quantity: z.coerce.number().int().positive().optional(),
  // Só é exigido quando é o 1º serviço depois do último fechamento — é o que
  // cria o Entry PENDENTE que vira a previsão no Fluxo de Caixa.
  dueDate: z.coerce.date().optional(),
});

// Edição de um serviço já lançado (ainda não pago). `description`/`quantity`
// vazios (""/null) limpam o campo.
export const updateCostureiraServicoSchema = z.object({
  date: z.coerce.date(),
  amount: z.union([z.string(), z.number()]),
  description: z.string().nullish(),
  quantity: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.coerce.number().int().positive().nullable(),
  ),
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
export type UpdateCostureiraServicoInput = z.infer<typeof updateCostureiraServicoSchema>;
export type PagarCostureiraInput = z.infer<typeof pagarCostureiraSchema>;
export type UpdateCostureiraDueDateInput = z.infer<typeof updateCostureiraDueDateSchema>;
