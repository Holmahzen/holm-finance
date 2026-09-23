import { NextRequest, NextResponse } from "next/server";
import { costureiraServicoService } from "@/services/costureiraServicoService";
import { createCostureiraServicoSchema } from "@/domain/schemas/costureiraServico";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const counterpartyId = searchParams.get("counterpartyId");
  if (!counterpartyId) {
    return NextResponse.json({ error: "counterpartyId é obrigatório." }, { status: 400 });
  }
  const pendentes = await costureiraServicoService.listPending(counterpartyId);
  return NextResponse.json(pendentes);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createCostureiraServicoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const servico = await costureiraServicoService.create(parsed.data);
  return NextResponse.json(servico, { status: 201 });
}
