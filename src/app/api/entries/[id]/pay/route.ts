import { NextRequest, NextResponse } from "next/server";
import { entryService } from "@/services/entryService";
import { payEntrySchema } from "@/domain/schemas/entry";
import { DomainError } from "@/domain/errors";

export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/entries/[id]/pay">,
) {
  const { id } = await ctx.params;
  const body = await request.json();
  const parsed = payEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const entry = await entryService.pay(id, parsed.data);
    return NextResponse.json(entry);
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
