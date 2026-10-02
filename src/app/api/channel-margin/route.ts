import { NextRequest, NextResponse } from "next/server";
import { channelMarginService } from "@/services/channelMarginService";

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const months = Number(params.get("months") ?? 1) || 1;
  return NextResponse.json(await channelMarginService.getReport(months, params.get("to") ?? undefined));
}
