import { NextRequest, NextResponse } from "next/server";
import { monthChecklistService } from "@/services/monthChecklistService";

export async function GET(request: NextRequest) {
  const month = new URL(request.url).searchParams.get("month") ?? undefined;
  return NextResponse.json(await monthChecklistService.getChecklist(month));
}
