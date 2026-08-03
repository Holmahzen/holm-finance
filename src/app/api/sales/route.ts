import { NextRequest, NextResponse } from "next/server";
import { salesService } from "@/services/salesService";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const now = new Date();
  const year = Number(searchParams.get("year") ?? now.getFullYear());
  const month = Number(searchParams.get("month") ?? now.getMonth() + 1);

  const report = await salesService.getReport(year, month);
  return NextResponse.json(report);
}
