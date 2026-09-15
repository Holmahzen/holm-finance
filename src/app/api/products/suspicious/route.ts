import { NextResponse } from "next/server";
import { productSuspiciousService } from "@/services/productSuspiciousService";

export async function GET() {
  const list = await productSuspiciousService.list();
  return NextResponse.json(list);
}
