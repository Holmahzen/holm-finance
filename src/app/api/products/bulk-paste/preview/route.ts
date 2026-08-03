import { NextRequest, NextResponse } from "next/server";
import { parseBulkProductPaste } from "@/domain/bulkProductPaste";
import { productService } from "@/services/productService";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const text = typeof body.text === "string" ? body.text : "";

  const { rows, errors } = parseBulkProductPaste(text);
  const preview = await productService.previewBulkUpsert(rows);

  return NextResponse.json({ rows: preview, errors });
}
