import { NextRequest, NextResponse } from "next/server";
import { entryService } from "@/services/entryService";
import { updateEntrySchema } from "@/domain/schemas/entry";
import { DomainError } from "@/domain/errors";

export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/entries/[id]">,
) {
  const { id } = await ctx.params;
  try {
    const entry = await entryService.get(id);
    return NextResponse.json(entry);
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/entries/[id]">,
) {
  const { id } = await ctx.params;
  const body = await request.json();
  const parsed = updateEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const entry = await entryService.update(id, parsed.data);
    return NextResponse.json(entry);
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<"/api/entries/[id]">,
) {
  const { id } = await ctx.params;
  try {
    await entryService.remove(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
