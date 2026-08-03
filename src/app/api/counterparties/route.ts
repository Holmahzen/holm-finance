import { NextRequest, NextResponse } from "next/server";
import { counterpartyService } from "@/services/counterpartyService";
import { createCounterpartySchema } from "@/domain/schemas/counterparty";

export async function GET() {
  const counterparties = await counterpartyService.list();
  return NextResponse.json(counterparties);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createCounterpartySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const counterparty = await counterpartyService.create(parsed.data);
  return NextResponse.json(counterparty, { status: 201 });
}
