import { z } from "zod";
import { entryTypeSchema } from "./category";

export const createEntrySchema = z.object({
  type: entryTypeSchema,
  description: z.string().min(1, "Descrição é obrigatória"),
  amount: z.union([z.string(), z.number()]),
  dueDate: z.coerce.date(),
  plannedPaymentDate: z.coerce.date().optional(),
  competenceDate: z.coerce.date().optional(),
  categoryId: z.string().optional(),
  counterpartyId: z.string().optional(),
  notes: z.string().optional(),
});

export const updateEntrySchema = createEntrySchema.partial();

export const payEntrySchema = z.object({
  bankAccountId: z.string().min(1, "Conta é obrigatória"),
  paidAmount: z.union([z.string(), z.number()]).optional(),
  paidAt: z.coerce.date().default(() => new Date()),
});

export type CreateEntryInput = z.infer<typeof createEntrySchema>;
export type UpdateEntryInput = z.infer<typeof updateEntrySchema>;
export type PayEntryInput = z.infer<typeof payEntrySchema>;
