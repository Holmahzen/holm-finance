import { z } from "zod";

export const createCreditCardPurchaseSchema = z.object({
  creditCardId: z.string().min(1, "Selecione o cartão"),
  description: z.string().min(1, "Descrição é obrigatória"),
  totalAmount: z.union([z.string(), z.number()]),
  installments: z.coerce.number().int().min(1, "Mínimo 1 parcela").max(48, "Máximo 48 parcelas"),
  purchaseDate: z.coerce.date(),
  firstDueDate: z.coerce.date(),
  // Pra lançar compras retroativas: se a compra já é de um tempo atrás e
  // algumas parcelas já foram pagas, elas entram direto como pagas em vez
  // de pendentes. Validado contra `installments` no service.
  paidInstallments: z.coerce.number().int().min(0).optional(),
  categoryId: z.string().optional(),
  counterpartyId: z.string().optional(),
});

// Edição fica restrita a campos descritivos (não muda valor/parcelas/datas
// já geradas — pra isso, excluir e cadastrar de novo, usando "parcelas já
// pagas" pra preservar o histórico das que já foram pagas).
export const updateCreditCardPurchaseSchema = z.object({
  creditCardId: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  categoryId: z.string().optional(),
  counterpartyId: z.string().optional(),
});

export type CreateCreditCardPurchaseInput = z.infer<typeof createCreditCardPurchaseSchema>;
export type UpdateCreditCardPurchaseInput = z.infer<typeof updateCreditCardPurchaseSchema>;
