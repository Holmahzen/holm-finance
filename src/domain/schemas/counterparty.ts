import { z } from "zod";

export const counterpartyTypeSchema = z.enum([
  "PESSOA_FISICA",
  "PESSOA_JURIDICA",
  "OUTRO",
]);

export const createCounterpartySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  document: z
    .string()
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  type: counterpartyTypeSchema.default("OUTRO"),
  aliases: z.array(z.string()).default([]),
  defaultCategoryId: z.string().optional(),
  isOwnEntity: z.boolean().default(false),
});

export const updateCounterpartySchema = createCounterpartySchema
  .partial()
  .extend({ isActive: z.boolean().optional() });

export type CreateCounterpartyInput = z.infer<typeof createCounterpartySchema>;
export type UpdateCounterpartyInput = z.infer<typeof updateCounterpartySchema>;
