import { NextRequest, NextResponse } from "next/server";
import { reconciliationService } from "@/services/reconciliationService";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const bankAccountId = searchParams.get("bankAccountId") ?? undefined;
  const limit = Math.min(Number(searchParams.get("limit")) || DEFAULT_LIMIT, MAX_LIMIT);
  const offset = Number(searchParams.get("offset")) || 0;

  const result = await reconciliationService.listUnmatchedTransactions({ bankAccountId, limit, offset });
  return NextResponse.json(result);
}
