import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { productModelService } from "@/services/productModelService";

export async function GET() {
  return NextResponse.json(await productModelService.list());
}

const money = z.coerce.number().min(0).max(100_000);
const applySchema = z.object({
  modelKey: z.string().min(1),
  skus: z.array(z.string().min(1)).min(1),
  cost: z.object({ tecidoCost: money, costuraCost: money, aviamentosCost: money }),
  includeKits: z.boolean().default(true),
});

export async function POST(request: NextRequest) {
  const parsed = applySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos: confira os custos e os tamanhos marcados." }, { status: 400 });
  }
  try {
    return NextResponse.json(await productModelService.applyCost(parsed.data));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Não foi possível salvar." }, { status: 400 });
  }
}
