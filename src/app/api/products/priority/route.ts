import { NextRequest, NextResponse } from "next/server";
import { productPriorityService } from "@/services/productPriorityService";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const now = new Date();
  const year = Number(searchParams.get("year") ?? now.getFullYear());
  const month = Number(searchParams.get("month") ?? now.getMonth() + 1);

  const list = await productPriorityService.getUncostedSkus(year, month);
  return NextResponse.json(list);
}
