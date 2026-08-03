import { NextRequest, NextResponse } from "next/server";
import { reconciliationService } from "@/services/reconciliationService";
import { DomainError } from "@/domain/errors";

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/reconciliation/transactions/[id]/create-entry">,
) {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  try {
    const result = await reconciliationService.createEntryFromTransaction(id, body?.categoryId);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
