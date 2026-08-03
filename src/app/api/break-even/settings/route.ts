import { NextRequest, NextResponse } from "next/server";
import { breakEvenSettingsService } from "@/services/breakEvenSettingsService";

export async function GET() {
  const settings = await breakEvenSettingsService.get();
  return NextResponse.json(settings);
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const threshold = body?.marginAlertThreshold;
  if (threshold === undefined || threshold === null) {
    return NextResponse.json({ error: "marginAlertThreshold é obrigatório." }, { status: 400 });
  }
  const settings = await breakEvenSettingsService.update(threshold);
  return NextResponse.json(settings);
}
