import { NextResponse } from "next/server";
import { ncmAuditService } from "@/services/ncmAuditService";

export async function GET() {
  return NextResponse.json(await ncmAuditService.getReport());
}
