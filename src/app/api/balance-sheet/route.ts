import { NextResponse } from "next/server";
import { balanceSheetService } from "@/services/balanceSheetService";

export async function GET() {
  const report = await balanceSheetService.getReport();
  return NextResponse.json(report);
}
