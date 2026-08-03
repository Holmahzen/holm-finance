import { NextRequest, NextResponse } from "next/server";
import { dreService } from "@/services/dreService";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  const dre = await dreService.getDRE(
    year ? Number(year) : undefined,
    month ? Number(month) : undefined,
  );
  return NextResponse.json(dre);
}
