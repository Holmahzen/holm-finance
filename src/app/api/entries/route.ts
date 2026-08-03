import { NextRequest, NextResponse } from "next/server";
import { entryService } from "@/services/entryService";
import { createEntrySchema } from "@/domain/schemas/entry";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year");
  const month = searchParams.get("month");
  const entries = await entryService.list({
    status: searchParams.get("status") ?? undefined,
    type: searchParams.get("type") ?? undefined,
    categoryId: searchParams.get("categoryId") ?? undefined,
    year: year ? Number(year) : undefined,
    month: month ? Number(month) : undefined,
  });
  return NextResponse.json(entries);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const entry = await entryService.create(parsed.data);
  return NextResponse.json(entry, { status: 201 });
}
