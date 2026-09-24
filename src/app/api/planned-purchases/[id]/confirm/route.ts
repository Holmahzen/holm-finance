import { NextRequest, NextResponse } from "next/server";
import { plannedPurchaseService } from "@/services/plannedPurchaseService";
import { DomainError } from "@/domain/errors";

export async function POST(_request: NextRequest, ctx: RouteContext<"/api/planned-purchases/[id]/confirm">) {
  const { id } = await ctx.params;
  try {
    const entries = await plannedPurchaseService.confirm(id);
    return NextResponse.json({ ok: true, entries: entries.length });
  } catch (err) {
    if (err instanceof DomainError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
