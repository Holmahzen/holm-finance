import { NextRequest, NextResponse } from "next/server";
import { accountService } from "@/services/accountService";
import { updateAccountSchema } from "@/domain/schemas/account";
import { DomainError } from "@/domain/errors";

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/accounts/[id]">,
) {
  const { id } = await ctx.params;
  try {
    const account = await accountService.get(id);
    return NextResponse.json(account);
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/accounts/[id]">,
) {
  const { id } = await ctx.params;
  const body = await request.json();
  const parsed = updateAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const account = await accountService.update(id, parsed.data);
    return NextResponse.json(account);
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/accounts/[id]">,
) {
  const { id } = await ctx.params;
  try {
    await accountService.remove(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
