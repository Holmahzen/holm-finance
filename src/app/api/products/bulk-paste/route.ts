import { NextRequest, NextResponse } from "next/server";
import { productService } from "@/services/productService";
import type { ParsedProductRow } from "@/domain/bulkProductPaste";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const rows = Array.isArray(body.rows) ? (body.rows as ParsedProductRow[]) : [];

  if (rows.length === 0) {
    return NextResponse.json({ error: "Nenhuma linha pra aplicar." }, { status: 400 });
  }

  const result = await productService.applyBulkUpsert(rows);
  return NextResponse.json(result);
}
