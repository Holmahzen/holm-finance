import { NextRequest, NextResponse } from "next/server";
import { cashFlowService } from "@/services/cashFlowService";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days = Number(searchParams.get("days") ?? 30);

  const report = await cashFlowService.getProjection(days);
  return NextResponse.json(report);
}
