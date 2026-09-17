import { NextRequest, NextResponse } from "next/server";
import { salesService } from "@/services/salesService";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  if (fromParam && toParam) {
    const from = new Date(`${fromParam}T00:00:00.000Z`);
    // `to` recebido é inclusivo (o último dia do intervalo) — soma 1 dia pra
    // virar o limite exclusivo que findByPeriod espera.
    const to = new Date(`${toParam}T00:00:00.000Z`);
    to.setUTCDate(to.getUTCDate() + 1);
    const report = await salesService.getReportByRange(from, to);
    return NextResponse.json(report);
  }

  const now = new Date();
  const year = Number(searchParams.get("year") ?? now.getFullYear());
  const month = Number(searchParams.get("month") ?? now.getMonth() + 1);

  const report = await salesService.getReport(year, month);
  return NextResponse.json(report);
}
