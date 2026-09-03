import { NextRequest, NextResponse } from "next/server";
import { balanceSheetItemService } from "@/services/balanceSheetItemService";
import { updateBalanceSheetItemSchema } from "@/domain/schemas/balanceSheetItem";
import { DomainError } from "@/domain/errors";

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/balance-sheet-items/[id]">,
) {
  const { id } = await ctx.params;
  const body = await request.json();
  const parsed = updateBalanceSheetItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const item = await balanceSheetItemService.update(id, parsed.data);
    return NextResponse.json(item);
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/balance-sheet-items/[id]">,
) {
  const { id } = await ctx.params;
  try {
    await balanceSheetItemService.remove(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
