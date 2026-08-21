import { z } from "zod";

export const reserveCategorySchema = z.enum(["THIRTEENTH", "VACATION", "CONTINGENCY", "TAX"]);

export const createReserveDepositSchema = z.object({
  category: reserveCategorySchema,
  amount: z.union([z.string(), z.number()]),
  date: z.coerce.date(),
  notes: z.string().optional(),
});

export type CreateReserveDepositInput = z.infer<typeof createReserveDepositSchema>;
