import { NextRequest, NextResponse } from "next/server";
import { counterpartyService } from "@/services/counterpartyService";
import { updateCounterpartySchema } from "@/domain/schemas/counterparty";
import { DomainError } from "@/domain/errors";

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/counterparties/[id]">,
) {
  const { id } = await ctx.params;
  const body = await request.json();
  const parsed = updateCounterpartySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const counterparty = await counterpartyService.update(id, parsed.data);
    return NextResponse.json(counterparty);
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
