import { NextRequest, NextResponse } from "next/server";
import { reconciliationService } from "@/services/reconciliationService";
import { DomainError } from "@/domain/errors";

export async function POST(
  _request: NextRequest,
  ctx: RouteContext<"/api/reconciliation/matches/[id]/reject">,
) {
  const { id } = await ctx.params;
  try {
    const match = await reconciliationService.rejectMatch(id);
    return NextResponse.json(match);
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
