import { NextRequest, NextResponse } from "next/server";
import { productReturnsService } from "@/services/productReturnsService";

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const months = Number(params.get("months") ?? 3) || 3;
  return NextResponse.json(await productReturnsService.getReport(months, params.get("to") ?? undefined));
}
