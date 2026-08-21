import { NextRequest, NextResponse } from "next/server";
import { creditCardPurchaseService } from "@/services/creditCardPurchaseService";
import { updateCreditCardPurchaseSchema } from "@/domain/schemas/creditCardPurchase";
import { DomainError } from "@/domain/errors";

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/credit-card-purchases/[id]">,
) {
  const { id } = await ctx.params;
  const body = await request.json();
  const parsed = updateCreditCardPurchaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const purchase = await creditCardPurchaseService.update(id, parsed.data);
    return NextResponse.json(purchase);
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/credit-card-purchases/[id]">,
) {
  const { id } = await ctx.params;
  try {
    await creditCardPurchaseService.remove(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
