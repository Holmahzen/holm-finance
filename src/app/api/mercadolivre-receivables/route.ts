import { NextRequest, NextResponse } from "next/server";
import { mercadoLivreReceivableService } from "@/services/mercadoLivreReceivableService";
import { updateMercadoLivreReceivableSchema } from "@/domain/schemas/mercadoLivreReceivable";

export async function GET() {
  const record = await mercadoLivreReceivableService.get();
  return NextResponse.json(record);
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const parsed = updateMercadoLivreReceivableSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const record = await mercadoLivreReceivableService.update(parsed.data);
  return NextResponse.json(record);
}
