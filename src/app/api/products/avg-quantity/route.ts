import { NextResponse } from "next/server";
import { avgMonthlyQuantityService } from "@/services/avgMonthlyQuantityService";

export async function GET() {
  const result = await avgMonthlyQuantityService.computeForAllSkus();
  return NextResponse.json(result);
}
