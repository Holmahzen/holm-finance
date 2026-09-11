import { NextResponse } from "next/server";
import { simplesNacionalService } from "@/services/simplesNacionalService";

export async function GET() {
  const report = await simplesNacionalService.getReport();
  return NextResponse.json(report);
}
