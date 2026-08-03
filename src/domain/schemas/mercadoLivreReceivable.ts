import { z } from "zod";

export const updateMercadoLivreReceivableSchema = z.object({
  today: z.union([z.string(), z.number()]).optional(),
  tomorrow: z.union([z.string(), z.number()]).optional(),
  within7d: z.union([z.string(), z.number()]).optional(),
  after7d: z.union([z.string(), z.number()]).optional(),
});

export type UpdateMercadoLivreReceivableInput = z.infer<typeof updateMercadoLivreReceivableSchema>;
