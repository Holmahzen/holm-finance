import { NextRequest, NextResponse } from "next/server";
import { creditCardService } from "@/services/creditCardService";
import { createCreditCardSchema } from "@/domain/schemas/creditCard";
import { DomainError } from "@/domain/errors";

export async function GET() {
  const cards = await creditCardService.list();
  return NextResponse.json(cards);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createCreditCardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const card = await creditCardService.create(parsed.data);
    return NextResponse.json(card, { status: 201 });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
