import { NextRequest, NextResponse } from "next/server";
import { cashReserveService } from "@/services/cashReserveService";

export async function GET(request: NextRequest) {
  const monthsParam = request.nextUrl.searchParams.get("contingencyMonths");
  const contingencyMonths = monthsParam ? Number(monthsParam) : 3;
  const taxRateParam = request.nextUrl.searchParams.get("taxRatePercent");
  const taxRatePercent = taxRateParam ? Number(taxRateParam) : 14;
  const taxDueDayParam = request.nextUrl.searchParams.get("taxDueDay");
  const taxDueDay = taxDueDayParam ? Number(taxDueDayParam) : 20;
  const report = await cashReserveService.getReport(contingencyMonths, taxRatePercent, taxDueDay);
  return NextResponse.json(report);
}
