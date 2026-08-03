import { NextResponse } from "next/server";
import { reconciliationService } from "@/services/reconciliationService";

export async function POST() {
  const result = await reconciliationService.runMatching();
  return NextResponse.json(result);
}
