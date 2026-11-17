import { NextRequest, NextResponse } from "next/server";
import { costureiraServicoService } from "@/services/costureiraServicoService";
import { updateCostureiraServicoSchema } from "@/domain/schemas/costureiraServico";
import { DomainError } from "@/domain/errors";

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/costureira-servicos/[id]">,
) {
  const { id } = await ctx.params;
  const parsed = updateCostureiraServicoSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Confira data, valor e quantidade." }, { status: 400 });
  }
  try {
    return NextResponse.json(await costureiraServicoService.update(id, parsed.data));
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

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
