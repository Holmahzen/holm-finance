import { NextRequest, NextResponse } from "next/server";
import { plannedPurchaseService } from "@/services/plannedPurchaseService";
import { createPlannedPurchaseSchema } from "@/domain/schemas/plannedPurchase";
import { DomainError } from "@/domain/errors";

export async function POST(request: NextRequest) {
  const parsed = createPlannedPurchaseSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    return NextResponse.json(await plannedPurchaseService.create(parsed.data), { status: 201 });
  } catch (err) {
    if (err instanceof DomainError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
