import { NextResponse } from "next/server";
import { creditCardPurchaseService } from "@/services/creditCardPurchaseService";

export async function GET() {
  const result = await creditCardPurchaseService.getAverageRevenue();
  return NextResponse.json(result);
}
