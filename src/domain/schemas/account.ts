import { z } from "zod";

export const accountTypeSchema = z.enum(["BANK", "CASH"]);

export const createAccountSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  type: accountTypeSchema,
  bankId: z.string().optional(),
  acctId: z.string().optional(),
  acctType: z.string().optional(),
  currency: z.string().default("BRL"),
  openingBalance: z.union([z.string(), z.number()]).default(0),
  openingBalanceDate: z.coerce.date().default(() => new Date()),
});

export const updateAccountSchema = createAccountSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
