import { NextRequest, NextResponse } from "next/server";
import { fixedCostService } from "@/services/fixedCostService";
import { updateFixedCostSchema } from "@/domain/schemas/fixedCost";
import { DomainError } from "@/domain/errors";

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/fixed-costs/[id]">,
) {
  const { id } = await ctx.params;
  const body = await request.json();
  const parsed = updateFixedCostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const fixedCost = await fixedCostService.update(id, parsed.data);
    return NextResponse.json(fixedCost);
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/fixed-costs/[id]">,
) {
  const { id } = await ctx.params;
  try {
    await fixedCostService.remove(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
