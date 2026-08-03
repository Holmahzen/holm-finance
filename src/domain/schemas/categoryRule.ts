import { z } from "zod";

export const createCategoryRuleSchema = z.object({
  keyword: z.string().min(1, "Palavra-chave é obrigatória"),
  categoryId: z.string().min(1, "Categoria é obrigatória"),
});

export type CreateCategoryRuleInput = z.infer<typeof createCategoryRuleSchema>;
