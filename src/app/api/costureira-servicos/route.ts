import { NextRequest, NextResponse } from "next/server";
import { costureiraServicoService } from "@/services/costureiraServicoService";
import { createCostureiraServicoSchema } from "@/domain/schemas/costureiraServico";
import { DomainError } from "@/domain/errors";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const counterpartyId = searchParams.get("counterpartyId");
  if (counterpartyId) {
    const pendentes = await costureiraServicoService.listPending(counterpartyId);
    return NextResponse.json(pendentes);
  }
  const grouped = await costureiraServicoService.listAllPendingGrouped();
  return NextResponse.json(grouped);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createCostureiraServicoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const servico = await costureiraServicoService.create(parsed.data);
    return NextResponse.json(servico, { status: 201 });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
