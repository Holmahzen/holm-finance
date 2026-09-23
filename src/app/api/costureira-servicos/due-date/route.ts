import { NextRequest, NextResponse } from "next/server";
import { costureiraServicoService } from "@/services/costureiraServicoService";
import { updateCostureiraDueDateSchema } from "@/domain/schemas/costureiraServico";
import { DomainError } from "@/domain/errors";

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { counterpartyId, ...rest } = body ?? {};
  if (typeof counterpartyId !== "string" || !counterpartyId) {
    return NextResponse.json({ error: "counterpartyId é obrigatório." }, { status: 400 });
  }
  const parsed = updateCostureiraDueDateSchema.safeParse(rest);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const entry = await costureiraServicoService.updateDueDate(counterpartyId, parsed.data);
    return NextResponse.json(entry);
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
