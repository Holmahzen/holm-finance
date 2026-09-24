import { NextRequest, NextResponse } from "next/server";
import { plannedPurchaseService } from "@/services/plannedPurchaseService";
import { DomainError } from "@/domain/errors";

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/planned-purchases/[id]">) {
  const { id } = await ctx.params;
  try {
    await plannedPurchaseService.remove(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof DomainError) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
}
