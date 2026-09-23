import { NextRequest, NextResponse } from "next/server";
import { costureiraServicoService } from "@/services/costureiraServicoService";
import { DomainError } from "@/domain/errors";

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/costureira-servicos/[id]">,
) {
  const { id } = await ctx.params;
  try {
    await costureiraServicoService.remove(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
