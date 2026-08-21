import { NextRequest, NextResponse } from "next/server";
import { creditCardService } from "@/services/creditCardService";
import { updateCreditCardSchema } from "@/domain/schemas/creditCard";
import { DomainError } from "@/domain/errors";

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/credit-cards/[id]">,
) {
  const { id } = await ctx.params;
  const body = await request.json();
  const parsed = updateCreditCardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const card = await creditCardService.update(id, parsed.data);
    return NextResponse.json(card);
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
