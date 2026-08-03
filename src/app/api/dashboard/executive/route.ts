import { NextRequest, NextResponse } from "next/server";
import { executiveDashboardService } from "@/services/executiveDashboardService";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  const summary = await executiveDashboardService.getSummary(
    year ? Number(year) : undefined,
    month ? Number(month) : undefined,
  );
  return NextResponse.json(summary);
}
