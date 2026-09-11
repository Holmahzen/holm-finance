import { NextRequest, NextResponse } from "next/server";
import { fiscalNoteReportService } from "@/services/fiscalNoteReportService";

export async function GET(request: NextRequest) {
  const month = new URL(request.url).searchParams.get("month");
  const report = await fiscalNoteReportService.getReport(
    month && /^\d{4}-\d{2}$/.test(month) ? month : undefined,
  );
  return NextResponse.json(report);
}
