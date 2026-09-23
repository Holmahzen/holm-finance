import { NextRequest, NextResponse } from "next/server";
import { costureiraServicoService } from "@/services/costureiraServicoService";
import { pagarCostureiraSchema } from "@/domain/schemas/costureiraServico";
import { DomainError } from "@/domain/errors";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = pagarCostureiraSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const result = await costureiraServicoService.pagar(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
