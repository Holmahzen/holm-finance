import { NextResponse } from "next/server";
import { reconciliationService } from "@/services/reconciliationService";

export async function GET() {
  const transactions = await reconciliationService.listUnmatchedTransactions();
  return NextResponse.json(transactions);
}
