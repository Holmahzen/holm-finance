import { NextResponse } from "next/server";
import { mlFullCostSummaryService } from "@/services/mlFullCostSummaryService";

export async function GET() {
  const summary = await mlFullCostSummaryService.getGeneralStorageByMonth();
  return NextResponse.json(summary);
}
