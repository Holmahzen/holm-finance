import { NextRequest, NextResponse } from "next/server";
import { reserveDepositService } from "@/services/reserveDepositService";
import { DomainError } from "@/domain/errors";

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/reserve-deposits/[id]">,
) {
  const { id } = await ctx.params;
  try {
    await reserveDepositService.remove(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
