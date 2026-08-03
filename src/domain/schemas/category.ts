import { z } from "zod";

export const entryTypeSchema = z.enum(["PAYABLE", "RECEIVABLE"]);

export const dreGroupSchema = z.enum([
  "RECEITA_BRUTA",
  "DEDUCOES_RECEITA",
  "CUSTO_MERCADORIA_VENDIDA",
  "CUSTO_VARIAVEL",
  "DESPESA_PESSOAL",
  "DESPESA_ADMINISTRATIVA",
  "DESPESA_COMERCIAL",
  "DESPESA_PRODUTIVA",
  "RESULTADO_FINANCEIRO_RECEITA",
  "RESULTADO_FINANCEIRO_DESPESA",
  "NAO_OPERACIONAL_RECEITA",
  "NAO_OPERACIONAL_DESPESA",
]);

export const createCategorySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  type: entryTypeSchema.optional(),
  parentId: z.string().optional(),
  dreGroup: dreGroupSchema.nullable().optional(),
  isAdvertising: z.boolean().optional(),
});

export const updateCategorySchema = createCategorySchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
