import { NextRequest, NextResponse } from "next/server";
import { creditCardPurchaseService } from "@/services/creditCardPurchaseService";
import { createCreditCardPurchaseSchema } from "@/domain/schemas/creditCardPurchase";
import { DomainError } from "@/domain/errors";

export async function GET() {
  const purchases = await creditCardPurchaseService.list();
  return NextResponse.json(purchases);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createCreditCardPurchaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const purchase = await creditCardPurchaseService.create(parsed.data);
    return NextResponse.json(purchase, { status: 201 });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
