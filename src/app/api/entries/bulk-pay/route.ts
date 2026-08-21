import { NextRequest, NextResponse } from "next/server";
import { entryService } from "@/services/entryService";
import { bulkPayEntrySchema } from "@/domain/schemas/entry";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = bulkPayEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await entryService.payMany(parsed.data);
  return NextResponse.json(result);
}
