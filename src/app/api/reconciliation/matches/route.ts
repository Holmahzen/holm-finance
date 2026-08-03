import { NextResponse } from "next/server";
import { reconciliationService } from "@/services/reconciliationService";

export async function GET() {
  const matches = await reconciliationService.list();
  return NextResponse.json(matches);
}
