import { NextRequest, NextResponse } from "next/server";
import { cashFlowService } from "@/services/cashFlowService";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") === "month" ? "month" : Number(searchParams.get("days") ?? 30);

  const report = await cashFlowService.getProjection(range);
  return NextResponse.json(report);
}
