import { NextRequest, NextResponse } from "next/server";
import { productPriorityService } from "@/services/productPriorityService";
import { todayUTCInBrazil } from "@/lib/today";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const now = todayUTCInBrazil();
  const year = Number(searchParams.get("year") ?? now.getUTCFullYear());
  const month = Number(searchParams.get("month") ?? now.getUTCMonth() + 1);

  const list = await productPriorityService.getUncostedSkus(year, month);
  return NextResponse.json(list);
}
