import { NextRequest, NextResponse } from "next/server";
import { companyProjectionService } from "@/services/companyProjectionService";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days = Number(searchParams.get("days") ?? 90);

  const report = await companyProjectionService.getReport(days);
  return NextResponse.json(report);
}
