import { NextRequest, NextResponse } from "next/server";
import { monthlyReportService } from "@/services/monthlyReportService";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  const report = await monthlyReportService.getReport(
    year ? Number(year) : undefined,
    month ? Number(month) : undefined,
  );
  return NextResponse.json(report);
}
