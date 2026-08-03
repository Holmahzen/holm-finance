import { NextRequest, NextResponse } from "next/server";
import { healthService } from "@/services/healthService";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const months = searchParams.get("months");
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  const report = await healthService.getReport(
    months ? Number(months) : undefined,
    year ? Number(year) : undefined,
    month ? Number(month) : undefined,
  );
  return NextResponse.json(report);
}
