import { NextRequest, NextResponse } from "next/server";
import { productProfitabilityService } from "@/services/productProfitabilityService";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const now = new Date();
  const year = Number(searchParams.get("year")) || now.getFullYear();
  const monthParam = searchParams.get("month");
  const month = monthParam !== null && monthParam !== "" ? Number(monthParam) : undefined;
  const marginThresholdParam = searchParams.get("marginThreshold");
  const marginThreshold = marginThresholdParam !== null ? Number(marginThresholdParam) : undefined;

  const report = await productProfitabilityService.getReport(year, month, marginThreshold);
  return NextResponse.json(report);
}
