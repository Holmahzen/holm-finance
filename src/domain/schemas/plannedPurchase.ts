import { z } from "zod";

export const createPlannedPurchaseSchema = z.object({
  // TECIDO/AVIAMENTOS mapeiam pra categoria de mesmo nome; OUTRO fica sem categoria.
  type: z.enum(["TECIDO", "AVIAMENTOS", "OUTRO"]),
  label: z.string().min(1).optional(),
  counterpartyId: z.string().optional(),
  amount: z.coerce.number().positive("Valor deve ser maior que zero"),
  dueDate: z.coerce.date(),
  installments: z.coerce.number().int().min(1).max(12).default(1),
  // Estimativa da costura que essa compra gera (normalmente só pra tecido).
  costuraAmount: z.coerce.number().positive().optional(),
  costuraDueDate: z.coerce.date().optional(),
});

export type CreatePlannedPurchaseInput = z.infer<typeof createPlannedPurchaseSchema>;
