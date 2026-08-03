import { NextRequest, NextResponse } from "next/server";
import { categoryRuleService } from "@/services/categoryRuleService";
import { DomainError } from "@/domain/errors";

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/category-rules/[id]">,
) {
  const { id } = await ctx.params;
  try {
    await categoryRuleService.remove(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
