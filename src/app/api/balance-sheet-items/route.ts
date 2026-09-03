import { NextRequest, NextResponse } from "next/server";
import { balanceSheetItemService } from "@/services/balanceSheetItemService";
import { createBalanceSheetItemSchema } from "@/domain/schemas/balanceSheetItem";
import { DomainError } from "@/domain/errors";

export async function GET() {
  const items = await balanceSheetItemService.list();
  return NextResponse.json(items);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = createBalanceSheetItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const item = await balanceSheetItemService.create(parsed.data);
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    if (err instanceof DomainError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
