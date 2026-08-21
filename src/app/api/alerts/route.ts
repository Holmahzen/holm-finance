import { NextResponse } from "next/server";
import { alertsHubService } from "@/services/alertsHubService";

export async function GET() {
  const alerts = await alertsHubService.getAlerts();
  return NextResponse.json(alerts);
}
