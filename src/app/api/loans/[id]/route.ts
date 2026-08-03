import { NextRequest, NextResponse } from "next/server";
import { loanService } from "@/services/loanService";
import { updateLoanSchema } from "@/domain/schemas/loan";
import { DomainError } from "@/domain/errors";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/loans/[id]">) {
  const { id } = await ctx.params;
  const body = await request.json();
  const parsed = updateLoanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const loan = await loanService.update(id, parsed.data);
    return NextResponse.json(loan);
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/loans/[id]">) {
  const { id } = await ctx.params;
  try {
    await loanService.remove(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
