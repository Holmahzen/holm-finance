import { NextRequest, NextResponse } from "next/server";
import { reserveDepositService } from "@/services/reserveDepositService";
import { createReserveDepositSchema } from "@/domain/schemas/reserveDeposit";
import { DomainError } from "@/domain/errors";

export async function GET() {
  const deposits = await reserveDepositService.list();
  return NextResponse.json(deposits);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createReserveDepositSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const deposit = await reserveDepositService.create(parsed.data);
    return NextResponse.json(deposit, { status: 201 });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
