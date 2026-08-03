import { NextRequest, NextResponse } from "next/server";
import { reconciliationService } from "@/services/reconciliationService";
import { DomainError } from "@/domain/errors";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const items = Array.isArray(body?.items) ? body.items : [];
  try {
    const result = await reconciliationService.createEntriesFromTransactions(items);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
