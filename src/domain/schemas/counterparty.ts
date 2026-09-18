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
  // Sem `.default()` aqui de propósito: o Prisma já tem @default(OUTRO)/@default([])/@default(false)
  // no schema, então isso não muda a criação — mas evita que `.partial()` (usado no update)
  // reponha esses valores-padrão em cima de campos que o caller nem quis tocar.
  type: counterpartyTypeSchema.optional(),
  aliases: z.array(z.string()).optional(),
  defaultCategoryId: z.string().optional(),
  isOwnEntity: z.boolean().optional(),
});

export const updateCounterpartySchema = createCounterpartySchema
  .partial()
  .extend({ isActive: z.boolean().optional() });

export type CreateCounterpartyInput = z.infer<typeof createCounterpartySchema>;
export type UpdateCounterpartyInput = z.infer<typeof updateCounterpartySchema>;
