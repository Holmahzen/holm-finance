import { NextRequest, NextResponse } from "next/server";
import { fixedCostService } from "@/services/fixedCostService";
import { createFixedCostSchema } from "@/domain/schemas/fixedCost";
import { DomainError } from "@/domain/errors";

export async function GET() {
  const fixedCosts = await fixedCostService.list();
  return NextResponse.json(fixedCosts);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createFixedCostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const fixedCost = await fixedCostService.create(parsed.data);
    return NextResponse.json(fixedCost, { status: 201 });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
